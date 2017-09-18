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

    static get Watcher() {
        return require('./watcher')
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

    get appPath() {
        return this._appPath
    }

    get faviconPath() {
        return this._faviconPath
    }

    initialize(done) {
        global.$server = this

        this._hostname = config('server.hostname', DEFAULT_HOSTNAME)
        this._port = config('server.port', DEFAULT_PORT)
        this._appPath = this.getAppPath()
        this._faviconPath = this.getFaviconPath()

        return this.setup(done)
    }

    getAppPath() {
        return node.path.dirname(require.main.filename)
    }

    getFaviconPath() {
        return fs(
            this.getAppPath(),
            FAVICON_FILE_NAME
        ).root
    }

    setup(done = _.noop) {
        if (this._http) {
            this._http.close()
        }

        if (!this._app) {
            this._app = new Server.App('/', this.appPath)
            this._app.set('port', this.port)
            // this._app.use(Server.Favicon(this.faviconPath))
        }

        this._http = Server.Http.createServer(this._app)
        process.nextTick(() => {
            global.$appl = this._app
            this._http.listen(this.port, this.hostname)

            return done()
        })
    }

    start(isClusterMode = false) {
        const cluster = require('cluster')

        if (isClusterMode && cluster.isMaster) {
            cluster.on('online', function(worker) {
                console.log('Worker ' + worker.process.pid + ' is online');
            })

            cluster.on('exit', function(worker, code, signal) {
                console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal)
                cluster.fork()
            })

            const numWorkers = require('os').cpus().length
            for (let i = 0; i < numWorkers; i++) {
                cluster.fork()
            }

            console.log('Master cluster setting up ' + numWorkers + ' workers...')
        } else {
            this.setup()
        }

        return this
    }

    autoRefresh() {
        const watcher = new Server.Watcher(this.appPath)
        watcher.on('change', (filePath) => {
            delete require.cache[filePath]
            this.setup()
        })
        watcher.start()
        return this
    }
}

module.exports = Server
