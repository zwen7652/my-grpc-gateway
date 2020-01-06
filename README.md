# my-grpc-gateway
基于Express框架的grpc网关

## 安装
```
npm install my-grpc-gateway
```

## 示例

```javascript
const Express = require('express');
const bodyParser = require('body-parser')

const app = Express();

const Gateway = require('my-grpc-gateway');
const config = {
    zkConnectionString: '192.168.228.128:2181',
    prefix: '/api', // 所有对外接口的前缀
    rules: [
        {
            path: '/v1/test/*',
            // host: 'localhost:5007',
            serviceName: '/services/test'
        },
        // {
        //     path: '*',
        //     host: 'localhost:5007',
        // }
    ]
};
const router = new Gateway(Express, __dirname + '/protos', config).getRouter();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(router);

const port = 1452;
app.listen(port, () => {
    console.log('gateway listen on', port);
})

// 现在可以请求 http://localhost:1452/api/v1/test/1/books/2
```

## config说明
* zkConnectionString 用于服务发现时连接zookeeper，不需要zookeeper时可为空
* prefix 所有对外接口的前缀，可为空
* rules 用于代理多个服务时的路由匹配规则，如果有多个匹配 则只会匹配第一个
    * path http请求地址
    * host 目标服务。该字段不为空则优先使用该字段，若为空则使用serviceName
    * serviceName 服务名称，即zookeeper中节点路径。host与serviceName不能同时为空