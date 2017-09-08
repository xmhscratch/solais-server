var watchman = require('fb-watchman')
var client = new watchman.Client()

class Watcher {

    constructor(rootPath) {
        this.rootPath = rootPath
        return this
    }

    start() {
        return client.capabilityCheck({
            optional: [],
            required: ['relative_root']
        }, (error, resp) => {
            if (error) {
                client.end()
                throw error
            }

            // Initiate the watch
            client.command([
                'watch-project', this.rootPath
            ], (error, resp) => {
                if (error) {
                    throw error
                }

                if ('warning' in resp) {
                    console.log('warning: ', resp.warning)
                }

                console.log('watch established on ', resp.watch, ' relative_path', resp.relative_path)
                this._makeSubscription(client, this.rootPath, resp.relative_path)
            })
        })
    }

    _makeSubscription(client, watch, relative_path) {
        const sub = {
            expression: ['allof',
                ['not', ['match', 'node_modules/**/*', 'wholename']],
                ['match', '**/*.js', 'wholename'],
                ['not', 'empty']
            ],
            fields: ['name', 'size', 'mtime_ms', 'exists', 'type']
        }

        if (relative_path) {
            sub.relative_root = relative_path
        }

        client.command([
            'subscribe', watch, 'watcher', sub
        ], (error, resp) => {
            if (error) {
                console.error('failed to subscribe: ', error)
                return
            }
            console.log('subscription ' + resp.subscribe + ' established')
        })

        client.on('subscription', (resp) => {
            if (resp.subscription !== 'watcher') return

            resp.files.forEach((file) => {
                console.log('file changed: ' + file.name)
            })
        })
    }
}

module.exports = Watcher
