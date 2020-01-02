
const _ = require('lodash');

const zkHelper = require('./zkHelper');

class ServiceDiscover {
    constructor(zkConnectionString) {
        this.serviceHelper = new zkHelper(zkConnectionString, this.zkWatcher.bind(this));

        this.serviceMap = {};
    }

    async zkWatcher(event) {
        this.getChildren(event.getPath());
    }

    async getChildren(path) {
        const childrens = await this.serviceHelper.getChildren(path, true);
        this.serviceMap[path] = { totalWeight: 0, services: [] };
        const childrenDatas = await Promise.all(_.map(childrens, (svc) => this.serviceHelper.getData(`${path}/${svc}`)));
        for(let item of childrenDatas){
            try {
                let svcInfo = JSON.parse(item);
                if (!('weight' in svcInfo)) {
                    svcInfo.weight = 10;
                }
                this.serviceMap[path].totalWeight += svcInfo.weight;
                svcInfo.currentWeight = 0;

                this.serviceMap[path].services.push(svcInfo);
            } catch (err) {
                throw `解析服务地址${item}失败，地址格式非正确的JSON格式`;
            }
        }
    }

    async getServiceInfo(name) {
        if (!(name in this.serviceMap)) {
            await this.getChildren(name);
        }
        let services = this.serviceMap[name].services;
        if (_.isEmpty(services)) {
            return;
        }
        if (services.length == 1) {
            return services[0].host;
        } 
        // 平滑负载均衡
        for(let item of services){
            item.currentWeight += item.weight;
        }
        const max = _.maxBy(services, item => item.currentWeight);
        max.currentWeight -= this.serviceMap[name].totalWeight;

        return max.host;
    }
}

module.exports = ServiceDiscover;