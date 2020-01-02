
const Express = require('express');
const bodyParser = require('body-parser')

const app = Express();

const Gateway = require('../src/gateway');
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