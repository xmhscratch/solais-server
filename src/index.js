const DEFAULT_HOSTNAME = '0.0.0.0'
const DEFAULT_PORT = 3000
const FAVICON_FILE_NAME = 'favicon.ico'

class Server extends System.Module {

    static get $ID() {
        return 'server'
    }

    static get DEFAULT_HOSTNAME() {
        return DEFAULT_HOSTNAME
    }

    static get DEFAULT_PORT() {
        return DEFAULT_PORT
    }

    static get FAVICON_FILE_NAME() {
        return FAVICON_FILE_NAME
    }

    static get Http() {
        return require('http')
    }

    static get Favicon() {
        return require('serve-favicon')
    }

    static get App() {
        return require('./app')
    }

    get app() {
        return this._app
    }

    set app(value) {
        this._app = value
        return this._app
    }

    get http() {
        if (!this._http) {
            system.emit('error', new Error('server is not setup'))
        }
        return this._http
    }

    get hostname() {
        return this._hostname
    }

    get port() {
        return this._port
    }

    get basePath() {
        return this._basePath
    }

    get faviconPath() {
        return this._faviconPath
    }

    constructor() {
        super()
    }

    initialize(done) {
        global.$server = this

        process.nextTick(() => {
            this.setup()
            global.$appl = this.app

            return done()
        })

        return this
    }

    getBasePath() {
        return $dcfg.getBasePath()
    }

    getFaviconPath() {
        return fs(
            this.getBasePath(),
            FAVICON_FILE_NAME
        ).root
    }

    setup() {
        this._hostname = config('server.hostname', DEFAULT_HOSTNAME)
        this._port = config('server.port', DEFAULT_PORT)
        this._basePath = this.getBasePath()
        this._faviconPath = this.getFaviconPath()

        this._app = new Server.App('/', this.basePath)
        this._app.set('port', this.port)
        // this._app.use(Server.Favicon(this.faviconPath))
    }

    start() {
        this._http = Server.Http.createServer(this._app)
        this._http.listen(this.port, this.hostname)

        return this
    }
}

module.exports = Server
