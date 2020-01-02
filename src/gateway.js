
const fs = require('fs');
const path = require('path');

const _ = require('lodash');

const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const protoSchema = require('protocol-buffers-schema');

const Service = require('./service');

class Gateway {

    /**
     * @param {*} Express Express
     * @param {*} protoDir proto文件所在目录，加载该目录及子目录下的所有.proto文件
     * @param {*} config rpc服务的相关配置 
     * @param {*} credentials rpc证书，默认为grpc.credentials.createInsecure()
     */
    constructor(Express, protoDir, config, credentials) {
        if (!_.isArray(config.rules)) {
            throw `rules必须是数组`;
        }
        this.protoDir = protoDir;
        this.config = config;
        this.Express = Express;

        // 匹配 url 中参数的正则表达式，如/v1/shelves/{shelf}/books/{book}
        this.urlParamReg = /{(\w+)}/g;

        // 支持的http请求方法
        this.supportedMethodsMap = {
            'get': true,
            'put': true,
            'post': true,
            'delete': true
        };

        this.credential = credentials || grpc.credentials.createInsecure();

        if (this.config.zkConnectionString){
            this.serviceHelper = new Service(this.config.zkConnectionString);
        }
    }

    getFiles(p) {
        let ret = [];
        if (!fs.existsSync(p)) {
            return ret;
        }
        let files = fs.readdirSync(p);
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let curPath = p + "/" + file;
            if (fs.statSync(curPath).isDirectory()) {
                let subFiles = this.getFiles(curPath);
                ret = ret.concat(subFiles);
            } else {
                ret.push(curPath);
            }
        }
        return ret;
    }

    /**
     * 加载 proto 文件
     * @param {*} protoFiles 
     */
    getProtos(protoFiles) {
        if (_.isEmpty(protoFiles)) {
            return;
        }
        if (!_.isArray(protoFiles)) {
            throw `protoFiles必须是数组`;
        }
        return _.map(protoFiles, file => {
            const packageDefinition = protoLoader.loadSync(file);
            return grpc.loadPackageDefinition(packageDefinition);
        });
    }

    /**
     * 解析 proto 文件
     * @param {*} protoFiles 
     */
    getProtoSchema(protoFiles) {
        if (_.isEmpty(protoFiles)) {
            return;
        }
        if (!_.isArray(protoFiles)) {
            throw `protoFiles必须是数组`;
        }
        return _.map(protoFiles, file => protoSchema.parse(fs.readFileSync(file)));
    }

    /**
     * 转换url，/v1/shelves/{shelf}/books/{book} 转换成 /v1/shelves/:name/books/:book
     * @param {*} url 
     */
    convertUrl(url) {
        if (_.isEmpty(url)) {
            throw `url不能为空`;
        }
        if (!_.isString(url)) {
            throw `url必须是字符串`;
        }
        return url.replace(this.urlParamReg, ':$1');
    }

    /**
     * 转换请求参数
     * @param {*} params req.params
     * @param {*} query  req.query
     * @param {*} body   req.body
     */
    convertRequestParams(params, query, body) {
        const ret = body || {};
        return _.assign(ret, query, params);
    }

    getMetadata(headers) {
        const ret = new grpc.Metadata();
        _.forEach(headers, (val, key) => ret.set(key, val));
        return ret;
    }

    /**
     * 匹配路由规则
     * @param {*} url 
     */
    matchRule(url) {
        if (_.isEmpty(url)) {
            throw `url不能为空`;
        }
        if (!_.isString(url)) {
            throw `url必须是字符串`;
        }
        if (_.isEmpty(this.config.rules)) {
            return;
        }
        let rule = null;
        for (let i = 0; i < this.config.rules.length; i++) {
            const r = this.config.rules[i];
            if (_.endsWith(r.path, '*')) {
                if (_.startsWith(url, r.path.slice(0, -1))) {
                    rule = r;
                    break;
                }
            } else if (r.path === url) {
                rule = r;
                break;
            }
        }
        return rule;
    }

    /**
     * 根据匹配到的规则，获取服务信息
     * @param {*} rule 
     */
    async getServiceHost(rule){
        if (_.isEmpty(rule)) {
            return;
        }
        let host = rule.host;
        if (!host && rule.serviceName){
            return await this.serviceHelper.getServiceInfo(rule.serviceName);
        }
        return host;
    }

    /**
     * 调用rpc服务之前执行，返回true时不再继续调用rpc服务
     * @param {*} serviceHost rpc服务地址
     * @param {*} params 请求参数
     * @param {*} metadata 元数据
     * @param {*} res http请求的response对象
     */
    beforeCallService(serviceHost, params, metadata, res) {
        return false;
    }

    /**
     * 接收完rpc服务响应的数据之后执行，返回true时不再继续代理
     * @param {*} serviceHost rpc服务地址
     * @param {*} err rpc服务响应的错误信息
     * @param {*} data rpc服务响应的数据
     * @param {*} res http请求的response对象
     */
    afterCallService(serviceHost, err, data, res) {
        return false;
    }

    /**
     * 找不到对应服务时调用，返回true时不再继续代理
     * @param {*} routerUrl 路由地址
     * @param {*} requestUrl 请求地址
     * @param {*} res http请求的response对象
     */
    unknownService(routerUrl, requestUrl, res){
        return false;
    }

    /**
     * 获取Express的Router
     */
    getRouter(debug = true) {
        const router = this.Express.Router();

        // 过滤出 proto 文件
        const protoFiles = _.filter(this.getFiles(this.protoDir), f => path.extname(f) === '.proto');
        if (_.isEmpty(protoFiles)) {
            return router;
        }
        const protos = this.getProtos(protoFiles);
        const schemas = this.getProtoSchema(protoFiles);
        for (let idx = 0; idx < schemas.length; idx++) {
            const sch = schemas[idx];
            if (_.isEmpty(sch.services)) {
                continue;
            }
            for (let svcIdx = 0; svcIdx < sch.services.length; svcIdx++) {
                const svc = sch.services[svcIdx];
                const svcName = svc.name;
                for (let mIdx = 0; mIdx < svc.methods.length; mIdx++) {
                    const svcMethod = svc.methods[mIdx];
                    const httpOpt = _.get(svcMethod, 'options');
                    if (_.isEmpty(httpOpt)) {
                        continue;
                    }
                    if (!('google.api.http' in httpOpt)) {
                        continue;
                    }
                    const httpOptInfo = httpOpt['google.api.http'];
                    _.forEach(httpOptInfo, (url, httpMethod) => {
                        const method = _.lowerCase(httpMethod);
                        if (!_.get(this.supportedMethodsMap, method)) {
                            return;
                        }
                        const routerUrl = `${this.config.prefix || ''}${this.convertUrl(url)}`;
                        if (debug) {
                            console.log(method.toUpperCase(), routerUrl);
                        }
                        // 添加路由
                        router[method](routerUrl, async (req, res) => {
                            let rule = this.matchRule(url);
                            let host = await this.getServiceHost(rule);
                            if (!host){
                                let isHandled = this.unknownService(routerUrl, req.url, res);
                                if (isHandled){
                                    return;
                                }
                                return res.send('未找到对应服务');
                            }
                            
                            const metadata = this.getMetadata(req.headers);

                            const params = this.convertRequestParams(req.params, req.query, req.body);

                            let isHandled = this.beforeCallService(host, params, metadata, res);
                            if (isHandled) {
                                return;
                            }
                            const client = new (protos[idx][sch.package][svcName])(host, this.credential);
                            client[svcMethod.name](params, metadata, (err, response) => {
                                isHandled = this.afterCallService(host, err, response, res);
                                if (isHandled) {
                                    return;
                                }
                                if (err) {
                                    console.error(err);
                                    return res.status(500).send(err);
                                }
                                res.send(response);
                            })
                        })
                    })
                }
            }
        }

        return router;
    }
}

module.exports = Gateway;