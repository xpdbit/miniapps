// Direct test inside container
const http = require('http');

// Login
const loginData = JSON.stringify({credential:"admin",password:"Admin123!"});
const loginOpts = {
  hostname: 'localhost', port: 3002, path: '/v1/auth/login',
  method: 'POST', headers: {'Content-Type':'application/json','Content-Length':loginData.length}
};

const req = http.request(loginOpts, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const loginResp = JSON.parse(body);
    const token = loginResp.data.access_token;
    console.log('Login ok, token:', token.substr(0,20)+'...');

    // Call models
    const modelsOpts = {
      hostname: 'localhost', port: 3002, path: '/v1/models',
      method: 'GET', headers: {'Authorization':'Bearer '+token}
    };
    http.get(modelsOpts, (res2) => {
      let body2 = '';
      res2.on('data', d => body2 += d);
      res2.on('end', () => {
        const modelsResp = JSON.parse(body2);
        console.log('Models code:', modelsResp.code);
        console.log('Models count:', modelsResp.data ? modelsResp.data.length : 'null');
        if (modelsResp.data && modelsResp.data.length > 0) {
          modelsResp.data.forEach(m => console.log(' -', m.modelId));
        } else {
          console.log('FULL RESPONSE:', JSON.stringify(modelsResp));
        }
      });
    });
  });
});
req.write(loginData);
req.end();
