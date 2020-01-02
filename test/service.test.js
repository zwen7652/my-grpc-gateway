const assert = require('assert');

const Express = require('express');

const Service = require('../src/service');

describe('service测试', () => {

    it('Gateway - getServiceInfo - 平滑负载均衡', async() => {
        const service = new Service('192.168.228.128:2181');
        service.serviceMap = {
            'test': {
                totalWeight: 10,
                services: [
                    {
                        host: 'A',
                        weight: 3,
                        currentWeight: 0
                    },
                    {
                        host: 'B',
                        weight: 5,
                        currentWeight: 0
                    },
                    {
                        host: 'C',
                        weight: 2,
                        currentWeight: 0
                    }
                ]
            }
        };
        const hosts = [];
        for(let i = 0; i < 10; i++){
            hosts.push(await service.getServiceInfo('test'));
        }
        assert.deepEqual(hosts, [ 'B', 'A', 'C', 'B', 'A', 'B', 'B', 'C', 'A', 'B' ]);

        service.serviceMap = {
            'test': {
                totalWeight: 10,
                services: [
                    {
                        host: 'A',
                        weight: 5,
                        currentWeight: 0
                    },
                    {
                        host: 'B',
                        weight: 5,
                        currentWeight: 0
                    }
                ]
            }
        };
        hosts.length = 0;
        for(let i = 0; i < 10; i++){
            hosts.push(await service.getServiceInfo('test'));
        }
        assert.deepEqual(hosts, [ 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B' ]);
    })

    it('Gateway - getServiceInfo - empty', async() => {
        const service = new Service('192.168.228.128:2181');
        service.serviceMap = {
            'test': {
                totalWeight: 0,
                services: []
            }
        };
        const host = await service.getServiceInfo('test')
        assert.deepEqual(host, undefined);
    })
})