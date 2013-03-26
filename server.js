var http = require("http"),
    socketio = require("socket.io"),
    redis = require("redis"),
    fs = require("fs");
var clients = new Array();
var currentTime;

var redisClient = redis.createClient(6379, 'localhost');


var server = http.createServer(function(req, res) {
    res.writeHead(200, { 'Content-type': 'text/html'});
    res.end(fs.readFileSync(__dirname + '/index.html'));
}).listen(8080);

var io = socketio.listen(server);

redisClient.on('ready', function () {
	redisClient.flushall( function (didSucceed) {
        //console.log(didSucceed);
        beginNewRound();
    });
	

	io.on('connection', function (socket)
	{
		console.log('NEW CONNECTION: '+socket.id);
		addClientToList(socket.id);
		
		socket.on('disconnect', function()
		{
			removeClientFromList(socket.id);
		});
		
		socket.on('leaderboardValue', function(data)
		{
			io.sockets.emit('leaderboardValue', data);
		});
		
		socket.on('setName', function(data)
		{
			console.log('INCOMING NAME');
			clients[socket.id]['name'] = data;
		});
		
		socket.on('requestTile', function(data)
		{
			console.log('INCOMING TILE REQUEST: '+data);
			redisClient.get(socket.id+':currentTile', function(err, res)
			{
				console.log('ERROR: '+err);
				if(res == '')	// CHECKOUT
				{
					redisClient.get(data+':tileOwner', function (err, res)
					{
						if(res == '')
						{
							redisClient.set(socket.id+':currentTile', data, function(test, test2)
							{
								redisClient.set(data+':tileOwner', socket.id, function()
								{
									redisClient.get(data+':tileValue', function(err, res)
									{
										socket.emit('tileShow', '{ "tileId":"'+data+'", "value":"'+res+'" }');
										socket.broadcast.emit('tilePeek', '{ "tileId":"'+data+'", "value":"'+res.substr(0,1)+'" }');
										console.log('Took It');
										console.log(test);
										console.log(test2);
									});
								});
							});
							redisClient.get(data+':tileValue', function (err, res)
							{
								console.log('TAKEN TILE IS: '+res);
								var tileValue = res;
								for (var i=0; i<4; i++)
								{
									redisClient.get(socket.id+':tile'+(i+1), function(err, res)
									{
										console.log('I REPEAT, TAKEN TILE IS: '+tileValue);
										console.log('YOUR TILE IS: '+res);
										if(tileValue == res)
										{
											redisClient.set(data+':tileTaken', 'true', function()
											{
												console.log('TILE TAKEN: '+data);
												redisClient.set(socket.id+':currentTile', '');
												io.sockets.emit('tileTaken', '{ "tileId":"'+data+'", "value":"'+tileValue+'" }');
												redisClient.incrby(socket.id+':score', 100+parseInt(currentTime/100), function()
												{
													redisClient.get(socket.id+':score', function(err, res)
													{
														socket.emit('score', res);
													});
												});
											});
										}
									});
								}
							});
						}
					});
				}
				else if(res == data)	// RETURN
				{
					redisClient.get(data+':tileTaken', function (err, res)
					{
						if(res == 'false')
						{
							redisClient.set(socket.id+':currentTile', '', function(test, test2)
							{
								redisClient.set(data+':tileOwner', '', function()
								{
									io.sockets.emit('tileHide', data);
									console.log('Returned It');
									console.log(test);
									console.log(test2);
								});
							});
						}
					});
				}
				else
				{
					console.log('ELSE CASE: '+res);
				}
			});
		});
	});
});


function addClientToList(socketId)
{
	var newClient = new Array();
	newClient['id'] = socketId;
	newClient['tile1'] = null;
	newClient['tile2'] = null;
	newClient['tile3'] = null;
	newClient['tile4'] = null;
	newClient['name'] = null;
	newClient['score'] = 0;
	newClient['currentTile'] = '';
	clients[socketId] = newClient;
	console.log('ADDED TO CLIENT LIST: '+socketId);
}

function addClientToRedis(client)
{
	redisClient.set(client['id']+':name', client['name']);
	redisClient.set(client['id']+':tile1', client['tile1']);
	redisClient.set(client['id']+':tile2', client['tile2']);
	redisClient.set(client['id']+':tile3', client['tile3']);
	redisClient.set(client['id']+':tile4', client['tile4']);
	redisClient.set(client['id']+':currentTile', client['currentTile']);
	redisClient.set(client['id']+':score', client['score']);
}

function removeClientFromList(socketId)
{
	clients[socketId] = null;
	console.log(clients);
}


// USELESS FUNCTION
function sendClientListToClient(socketId)
{
	io.sockets.socket(socketId).emit('clientList', clients[socketId].toString());
}

function addTilesToRedis(tiles)
{
	//console.log(tiles);
	for(var i=0; i<tiles.length; i++)
	{
		redisClient.set(i+':tileValue', tiles[i]);
		redisClient.set(i+':tileOwner', '');
		redisClient.set(i+':tileTaken', 'false');
	}
}

function getTileValueFromRedis(tileId)
{
	redisClient.get(tileId+':tileValue', function(err,res)
	{
		console.log('TileValue: '+res);
	});
}

function generateNewTiles()
{
	var gTileArray = new Array();
	var gColorArray = new Array();
	gColorArray[0] = 'R';
	gColorArray[1] = 'G';
	gColorArray[2] = 'B';
	gColorArray[3] = 'Y';
	for(var i=0; i<40; i++)
	{
		var tileString = gColorArray[Math.floor(i/10)];
		tileString += Math.floor(i%10);
		gTileArray[i] = tileString;
	}
	for(var j, x, i = gTileArray.length; i; j = parseInt(Math.random() * i), x = gTileArray[--i], gTileArray[i] = gTileArray[j], gTileArray[j] = x);
	return gTileArray;
}

/*function emitLeaderBoard()
{
	/*redisClient.keys('*:score', function(err, keys)
	{
		for(var i in keys)
		{
			var index = i;
			redisClient.get(keys[index], function (err, res)
			{
				var userScore = res;
				console.log(keys[index].substr(0,21)+'name');
				redisClient.get(keys[index].substr(0,21)+'name', function (err, res)
				{
					var userName = res;
					io.sockets.emit('leaderboardValue', '{ "userName":"'+userName+'", "score":"'+userScore+'" }');
					//console.log(userScores);
				});
			});
		}
	});
	
	redisClient.keys('*:score', function(err, keys)
	{
		for(var i=0; i<keys.length; i++)
		{
			redisClient.set(keys[i].substr(0,20)+':leaderboard', i, function()
			{
				redisClient.get(keys[i], function (err, res)
				{
					io.sockets.emit('leaderboardScore', '{ "id":"'+res+'", "score":"'+res+'" }');
									
				});
				redisClient.get(keys[i].substr(0,21)+'name', function (err, res)
				{
					io.sockets.emit('leaderboardName', '{ "id":"'+res+'", "name":"'+res+'" }');
					//console.log(userScores);
				});
			});
		}
	});
	
}*/

function runTimer(time)
{
	currentTime = ((time+1)*1000);
	var timer = setInterval(function(){
		currentTime -= 50;
		if(currentTime >= 0 && (currentTime/1000) == parseInt(currentTime/1000))
		{
			io.sockets.emit('timer', (currentTime/1000)-10);
		}
		if(currentTime == 10000)
		{
			//emitLeaderBoard();
		}
		if(currentTime < 0)
		{
			clearInterval(timer);
			beginNewRound();
		}
	}, 50);
}

function beginNewRound()
{
	redisClient.flushall( function (didSucceed) {
		var newRoundTileArray = generateNewTiles();
		addTilesToRedis(newRoundTileArray);
		runTimer(30);
		//console.log('Client list: '+clients);
		io.sockets.emit('reset','');
		for(var i in clients)
		{
			if (clients[i] != null && clients[i]['name'] != null)
			{
				for(var tileIndex=0; tileIndex < 4; tileIndex++)
				{
					clients[i]['tile'+(tileIndex+1)] = newRoundTileArray[Math.floor(Math.random()*40)];
					io.sockets.socket(clients[i]['id']).emit('tile', clients[i]['tile'+(tileIndex+1)]);
				}
				console.log(clients[i]);
				addClientToRedis(clients[i]);
			}
		}
    });

}