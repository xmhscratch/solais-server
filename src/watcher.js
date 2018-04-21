class Watcher extends node.events {

    constructor(rootPath) {
        super()

        const watchman = require('fb-watchman')
        this.client = new watchman.Client()
        this.rootPath = rootPath

        return this
    }

    start() {
        return this.client.capabilityCheck({
            optional: [],
            required: ['relative_root']
        }, (error, resp) => {
            if (error) {
                this.client.end()
                throw error
            }

            this.client.command([
                'watch', this.rootPath
                // 'watch-project', this.rootPath
            ], (error, resp) => {
                if (error) {
                    throw error
                }

                if ('warning' in resp) {
                    console.log('warning: ', resp.warning)
                }

                this._makeSubscription(resp.relative_path)
            })
        })
    }

    _makeSubscription(relativePath) {
        const sub = {
            expression: ['allof',
                ['not', ['match', 'node_modules/**/*', 'wholename']],
                ['match', '**/*.js', 'wholename'],
                ['not', 'empty']
            ],
            fields: ['name', 'size', 'mtime_ms', 'exists', 'type']
        }

        if (relativePath) {
            sub.relative_root = relativePath
        }

        this.client.command([
            'subscribe', this.rootPath, 'watcher', sub
        ], (error, resp) => {
            if (error) {
                console.error('failed to subscribe: ', error)
                return
            }
        })

        this.client.on('subscription', (resp) => {
            if (resp.subscription !== 'watcher') {
                return
            }

            resp.files.forEach((file) => {
                const filePath = node.path.resolve(resp.root, file.name)
                this.emit('change', filePath)
            })
        })

        return this
    }
}

module.exports = Watcher
