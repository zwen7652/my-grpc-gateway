
const zookeeper = require('node-zookeeper-client');

class ZookeeperHelper {
    constructor(connectionString, watcher) {
        this.client = zookeeper.createClient(connectionString, {
            sessionTimeout: 5000,
            spinDelay : 1000,
            retries : 0
        });
        this.client.connect();
        this.watcher = watcher;
    }

    /**
     * 获取指定路径下的子路径
     * @param {*} path 路径
     * @param {*} watch 是否需要监听
     */
    getChildren(path, watch) {
        return new Promise((resolve, reject) => {
            if (watch) {
                this.client.getChildren(path, this.watcher, (err, children) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(children);
                })
            } else {
                this.client.getChildren(path, (err, children) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(children);
                })
            }
        })
    }

    getData(path){
        return new Promise((resolve, reject) => {
            this.client.getData(path, (err, data) => {
                if (err){
                    return reject(err);
                }
                resolve(data && data.toString());
            })
        })
    }
}

module.exports = ZookeeperHelper;