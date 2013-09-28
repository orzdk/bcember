var express = require('express');
var bcrest = require('./bc-emb-rest');

//--------------------------------------
// Options
//--------------------------------------
var BLOCKCHAIN_REST_OFF = false;

//--------------------------------------
// Client
//--------------------------------------

var clientapp = express();
clientapp.use(express.static(__dirname + '/client'));
clientapp.listen(3000);
bcrest.conslog('! CONTENT server START on http://orz.dk:3000');

//--------------------------------------
// REST Server for ember-data
//--------------------------------------

var app = express(); 
 
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, token, uid');
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    } 
};

app.configure(function () {
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(allowCrossDomain);
});

app.get('/users', bcrest.findAllUsers);
app.get('/users/:uid', bcrest.findOneUser);
app.post('/users', bcrest.addUser);

//app.get('/dashboards/:id', bcrest.findFake); //todo: ember-data emits a request for this url, findone dashboard should go to monadrs
											// for now we return empty object urgh :E
											
app.get('/dashboards', bcrest.findUserDashboards);
app.post('/dashboards', bcrest.addDashboard);
app.delete('/dashboards/:id', bcrest.deleteDashboard);

app.get('/monadrs', bcrest.findMonadrs);
app.put('/monadrs/:id', bcrest.updateMonadr);
app.post('/monadrs', bcrest.addMonadr);
app.delete('/monadrs/:id', bcrest.deleteMonadr);

app.post('/auth.json', bcrest.authenticateUser);

app.listen(3003);
bcrest.conslog('! REST server START on http://orz.dk:3003');

//---------------------------------------
// WS Server for blockchain REST pooling
//---------------------------------------



var WebSocket = require('ws');
var WebSocketServer = require('ws').Server
  , wsserver = new WebSocketServer({port: 3010});
var _ = require('underscore');
var rest = require('restler');

var clients = [];

clientAdrArr = function(){
	var adrstr = "";
	var sep = "";
	var adrcount = 0;
	_.each(clients, function(client) {
		_.each(client.adrs, function(data, key){
			adrcount++;
			adrstr += sep + key;
			sep = "|";
		});
	});
	return {adrstr:adrstr, adrcount: adrcount};
}

publishChanged = function(){
	_.each(clients, function(client) {
		var dirtyAdrs = [];
		_.each(client.adrs, function(adrobj, adrstr){
			if (adrobj.dirty){
				dirtyAdrs.push({adr: adrstr, newbalance: adrobj.balance});
			}
		});
		_.each(dirtyAdrs, function(dirtyadr){
			bcrest.conslog('! ADRBAL-MSG', client.clienttoken + ' - ' + JSON.stringify({adr: dirtyadr.adr, newbalance: dirtyadr.newbalance}));
			client.ws.send(JSON.stringify({adr: dirtyadr.adr, newbalance: dirtyadr.newbalance}));
		});
	});
}

restRefresh = function(){
	adrParam = clientAdrArr();
	if (adrParam.adrcount > 0 && !BLOCKCHAIN_REST_OFF){
		bcrest.conslog('? DIRTY CHECK' , 'Clients: ' + clients.length + ', Adrs: ' + adrParam.adrcount);
		adrMultiUrl = 'http://blockchain.info/multiaddr?active=' + adrParam.adrstr;
		bcrest.conslog('! REST GET ' + adrParam.adrcount);
		rest.get(adrMultiUrl).on('complete', function(restReply) {
			bcrest.conslog('! REST RECEIVED ' + _.size(restReply.addresses));
			_.each(restReply.addresses, function(reply) {
				_.each(	_.filter(clients, function(client){	return _.has(client.adrs, reply.address);}), function(client){
					console.log('balance: ' + client.adrs[reply.address].balance);
					client.adrs[reply.address] = {
						balance: reply.final_balance, 
						dirty: (client.adrs[reply.address].balance != reply.final_balance)
					};
				});
			});		
			publishChanged();
		}); 
	} else {
		bcrest.conslog('* IDLE *');
	}
}

wsserver.on('connection', function(clientsocket) {

	clientsocket.on('message', function(message) {
		bcrest.conslog('! RECEIVED CLIENT MESSAGE', message);
		var that = this;
		
		var msgobj = JSON.parse(message);
		var clientobj = {ws: clientsocket, clienttoken: msgobj.clienttoken, adrs: msgobj.adrs}
		
		this.clienttoken = msgobj.clienttoken;	
		
		clients = _.reject(clients, function(clientt){ return clientt.clienttoken == that.clienttoken; });
		clients.push(clientobj);
		bcrest.conslog('! CLIENT ADDED', clientobj.clienttoken);
	});
	
	clientsocket.on('close', function(f){
		bcrest.conslog('! CLIENT CLOSED');
		var that=this;
		clients = _.reject(clients, function(clientt){ return clientt.clienttoken == that.clienttoken; });
		bcrest.conslog('! CLIENT REMOVED', that.clienttoken);
	});
	
});

bcrest.conslog('! SOCKET server START on http://orz.dk:3010');	

setInterval(function(){
	restRefresh();
}, 11000);







