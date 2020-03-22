const assert = require('assert');

const Express = require('express');

const Gateway = require('../index');
const Service = require('../src/service');

describe('网关测试', () => {

    const config = {
        zkConnectionString: '192.168.228.128:2181',
        prefix: '/api', // 所有对外接口的前缀
        rules: [
            {
                path: '/v1/test/*',
                // serviceName: '/services/test',
                host: 'localhost:5007',
            }
        ]
    };
    const protoDir = __dirname + '/data/protos';
    const gateway = new Gateway(Express, protoDir, config);
    gateway.init();

    it('Gateway - constructor - rules不正确', () => {
        let err;
        try {
            new Gateway(Express, protoDir, {});
        } catch (error) {
            err = error;
        }
        assert.deepEqual(err, 'config.rules必须是数组');
    })

    it('Gateway - constructor - zookeeper', () => {
        let g = new Gateway(Express, protoDir, {
            zkConnectionString: 'localhost:2181',
            rules: config.rules
        });
        g.init();
        assert.deepEqual(g.serviceHelper instanceof Service, true);
    })

    it('Gateway - getFiles', () => {
        let protoFiles = gateway.getFiles(protoDir);
        assert.equal(3, protoFiles.length);
    })

    it('Gateway - getFiles - notExists', () => {
        let protoFiles = gateway.getFiles('./notExists');
        assert.equal(0, protoFiles.length);
    })

    it('Gateway - getProtos - empty', () => {
        let protos = gateway.getProtos([]);
        assert.equal(protos, undefined);
    })

    it('Gateway - getProtos - error', () => {
        let err;
        try {
            gateway.getProtos({ a: 'a' });
        } catch (error) {
            err = error;
        }
        assert.equal(err, 'protoFiles必须是数组');
    })

    it('Gateway - getProtoSchema - empty', () => {
        let protos = gateway.getProtoSchema([]);
        assert.equal(protos, undefined);
    })

    it('Gateway - getProtoSchema - error', () => {
        let err;
        try {
            gateway.getProtoSchema({ a: 'a' });
        } catch (error) {
            err = error;
        }
        assert.equal(err, 'protoFiles必须是数组');
    })

    it('Gateway - convertUrl - error', () => {
        let err;
        try {
            gateway.convertUrl();
        } catch (error) {
            err = error;
        }
        assert.equal(err, 'url不能为空');
        try {
            gateway.convertUrl({ a: 'a' });
        } catch (error) {
            err = error;
        }
        assert.equal(err, 'url必须是字符串');
    })

    it('Gateway - matchRule - error', () => {
        let err;
        try {
            gateway.matchRule();
        } catch (error) {
            err = error;
        }
        assert.equal(err, 'url不能为空');
        try {
            gateway.matchRule({ a: 'a' });
        } catch (error) {
            err = error;
        }
        assert.equal(err, 'url必须是字符串');
    })

    it('Gateway - matchRule - empty', () => {
        const g = new Gateway(Express, protoDir, { rules: [] });
        let rule = g.matchRule('/v1/test');
        assert.equal(rule, undefined);
    })

    it('Gateway - matchRule', () => {
        const rules = [
            { path: '/api/v1/test' },
            { path: '/api/v2/*' },
            { path: '/v1/test' }
        ]
        const g = new Gateway(Express, protoDir, { rules: rules });

        let rule = g.matchRule('/v1/test');
        assert.deepEqual(rule, rules[2]);

        rule = g.matchRule('/v2');
        assert.deepEqual(rule, null);
    })

    it('Gateway - getServiceHost - empty', async () => {
        let ret = await gateway.getServiceHost();
        assert.deepEqual(ret, undefined);
    })

    it('Gateway - getServiceHost', async () => {
        let ret = await gateway.getServiceHost({ serviceName: '/services/test' });
        assert.deepEqual(ret, undefined);
    })

    it('Gateway - getRouter', (done) => {
        let router = gateway.getRouter();

        assert.equal(2, router.stack.length);
        done();
    })

    it('Gateway - request', (done) => {
        let router = gateway.getRouter();

        const app = Express();
        app.use(router);
        const request = require('supertest')(app);
        request.get('/api/v1/test/1/books/2')
            .expect(200).end((err, res) => {
            })
        done();
    })
})