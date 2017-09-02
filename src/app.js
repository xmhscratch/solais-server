const VIEW_PATH_NAME = 'view'
const CONTROLLER_PATH_NAME = 'controller'
const HELPER_PATH_NAME = 'helper'

class App {

    //////////////////////////
    // INSTANCE & CONSTANCE //
    //////////////////////////

    static get VIEW_PATH_NAME() {
        return VIEW_PATH_NAME
    }

    static get CONTROLLER_PATH_NAME() {
        return CONTROLLER_PATH_NAME
    }

    static get HELPER_PATH_NAME() {
        return HELPER_PATH_NAME
    }

    static get Express() {
        return require('express')
    }

    static get Logger() {
        return require('morgan')
    }

    static get Session() {
        return require('express-session')
    }

    static get CookieParser() {
        return require('cookie-parser')
    }

    static get BodyParser() {
        return require('body-parser')
    }

    static get Compression() {
        return require('compression')
    }

    static get Sitemap() {
        return require('sitemap')
    }

    ///////////////////////
    // PUBLIC PROPERTIES //
    ///////////////////////

    get engine() {
        return this._engine
    }

    get mountPoint() {
        return this._mountPoint
    }

    get basePath() {
        return this._basePath
    }

    get viewPath() {
        return this._viewPath
    }

    get controllerPath() {
        return this._controllerPath
    }

    get middwarePath() {
        return this._middwarePath
    }

    get helperPath() {
        return this._helperPath
    }

    get controllers() {
        return this._controllers
    }

    constructor(mountPoint, basePath) {
        this._mountPoint = mountPoint || '/'
        this._basePath = __(basePath).root

        this._viewPath = this.getViewPath()
        this._controllerPath = this.getControllerPath()
        this._middwarePath = this.getMiddwarePath()
        this._helperPath = this.getHelperPath()
        this._engine = this.createEngine()
        this._controllers = this.createControllers()

        this._loadMiddware(config('middwares', []))
        this._registerHelper()

        this.initialize()
    }

    initialize() {}

    createEngine() {
        let engine = App.Express()

        if (config('system.development', true)) {
            engine.use(App.Logger('dev'))
        }

        // view engine setup
        engine.set('views', this.viewPath)
        engine.set('view engine', config('server.view_engine', 'ejs'))

        engine.use(App.BodyParser.json(
            config('server.body_parser.json', {})
        ))

        engine.use(App.BodyParser.urlencoded(
            config(
                'server.body_parser.urlencoded',
                { extended: true }
            )
        ))

        const defaultSecret = 'R7Ns5NgnHOaPwOf6G4tgG8Ik5PxB0dqC'

        if (config('server.cookie')) {
            engine.use(App.CookieParser(
                config('server.secret', defaultSecret),
                config('server.cookie', false)
            ))
        }

        const defaultSession = {
            name: 'connect.sid',
            secret: config('server.secret', defaultSecret),
            resave: false,
            saveUninitialized: false
        }

        if (config('server.session')) {
            engine.use(App.Session(
                config('server.session', defaultSession)
            ))
        }

        if (config('server.compression')) {
            engine.use(App.Compression(
                config('server.compression')
            ))
        }

        engine.get('/robots.txt', (req, res, next) => {
            res.type('text/plain')

            let robotsFilePath = node.path.join(this.basePath, 'robots.txt')
            return node.fs.access(robotsFilePath, node.fs.R_OK | node.fs.W_OK, (error) => {
                if (error) {
                    res.write("User-agent: *\n")
                    res.write("Allow: /")
                } else {
                    res.write(node.fs.readFileSync(robotsFilePath, 'utf8'))
                }
                return res.status(200).end()
            })
        })

        engine.get('/sitemap.xml', (req, res, next) => {
            res.type('application/xml')

            const configPath = node.path.join(
                this.controllerPath, 'sitemap'
            )
            const sitemapConfig = require(configPath)
            const sitemap = App.Sitemap.createSitemap(sitemapConfig)

            res.write(sitemap.toString())
            return res.status(200).end()
        })

        return engine
    }

    createControllers() {
        return _.chain(
                __(this.controllerPath).getItems(/\.http\.js$/g)
            )
            .reduce((result, filePaths, path) => {
                const routeFiles = _.map(filePaths, (filePath) => {
                    const ctrlPath = filePath
                        .replace(/\.http\.js$/g, String())
                    const ctrlName = node.path.basename(ctrlPath)

                    const mountPoint = node.path.resolve(
                        this.mountPoint, node.path.relative(
                            this.controllerPath, ctrlPath
                        )
                    )

                    return {
                        root: filePath,
                        mountPoint: !_.isEqual(ctrlName, 'index')
                            ? mountPoint
                            : node.path.dirname(mountPoint),
                        dirpath: path
                    }
                })
                return _.union(result, routeFiles)
            }, [])
            .map((item) => {
                const rConfig = require(item.root)
                const router = App.Express.Router({
                    caseSensitive: false,
                    mergeParams: false,
                    strict: false
                })

                if (_.isFunction(rConfig)) {
                    return this._engine.use(
                        item.mountPoint,
                        rConfig(router)
                    )
                }

                _.forEach(rConfig, (methods, routePath) => {
                    routePath = node.path
                        .join(item.mountPoint, routePath)
                        .replace(/([\/\\]+)/g, String('/'))

                    const routerRoute = router.route(routePath)
                    const allowedMethods = this._getRequestAllowedMethods()

                    _.forEach(methods, (actions, method) => {
                        method = _.words(method, /[^, ]+/g)

                        _.forEach(method, (methodName) => {
                            methodName = methodName.toLowerCase()
                            const isAllowed = _.includes(allowedMethods, methodName)

                            if (!isAllowed) {
                                return
                            }

                            actions = _.chain(actions)
                                .castArray()
                                .map((action) => {
                                    return function() {
                                        return action.apply(this, arguments)
                                    }
                                })
                                .value()

                            routerRoute[methodName].apply(routerRoute, actions)
                        })
                    })
                })

                return this._engine.use(router)
            })
            .value()
    }

    getViewPath() {
        return __(
            this.basePath,
            VIEW_PATH_NAME
        ).root
    }

    getControllerPath() {
        return __(
            this.basePath,
            CONTROLLER_PATH_NAME
        ).root
    }

    getMiddwarePath() {
        return __(
            this.basePath,
            CONTROLLER_PATH_NAME,
            'index.js'
        ).root
    }

    getHelperPath() {
        return __(
            this.basePath,
            HELPER_PATH_NAME
        ).root
    }

    _getRequestAllowedMethods() {
        return _.map(node.http.METHODS, (method) => {
            return method.toLowerCase()
        })
    }

    _loadMiddware(baseMiddware) {
        if (_.isEmpty(this.middwarePath)) {
            return
        }

        let middwares = require(this.middwarePath)
        if (_.isObject(middwares)) {
            middwares = _.values(middwares)
        }
        middwares = _.castArray(middwares)

        if (baseMiddware && _.isArray(baseMiddware)) {
            middwares = _.concat(baseMiddware, middwares)
        }

        return _.forEach(
            middwares, (middware) => {
                return this._engine.use(middware)
            }, this
        )
    }

    _registerHelper() {
        const helpers = {}
        const fileItems = __(this.helperPath).getItems(/\.js$/g)

        const addHelper = (keyPath, func) => {
            helpers[keyPath] = func
            return helpers
        }

        global.helper = (keyPath) => {
            return _.get(helpers, keyPath, false)
        }

        return _.forEach(fileItems, (filePaths) => {
            return _.forEach(filePaths, (filePath) => {
                const keyPath = node.path
                    .relative(this.getHelperPath(), filePath)
                    .replace(/\.js$/g, String())
                const helperFunc = require(filePath)

                return addHelper(
                    keyPath.replace(/(\\|\\\\|\/|\/\/)/g, '/'),
                    helperFunc
                )
            })
        })
    }
}

module.exports = App
