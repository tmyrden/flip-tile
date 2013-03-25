var http = require("http"),
    socketio = require("socket.io"),
    redis = require("redis"),
    fs = require("fs");

var clients = new Array();

var currentTime;

/*var redisClient = redis.createClient(6379, 'nodejitsudb6390461707.redis.irstack.com', { 'maxReconnectionAttempts': 10});
redisClient.auth("nodejitsudb6390461707.redis.irstack.com:f327cfe980c971946e80b8e975fbebb4", function(err) {
  if (err) {
    throw err;
  }
});*/

var redisClient = redis.createClient(6379, 'localhost');


var server = http.createServer(function(req, res) {
    res.writeHead(200, { 'Content-type': 'text/html'});
    res.end(fs.readFileSync(__dirname + '/index.html'));
}).listen(8080);

var io = socketio.listen(server);

var mainTileArray = randomTileArray();

redisClient.on('ready', function () {
	runTimer(30);
	redisClient.flushall( function (didSucceed) {
        console.log(didSucceed); // true
        for (var i=0; i < 40; i++)
		{
			createTile(i);
			setTileColor(i, mainTileArray[i].substr(0,1));
			//console.log(mainTileArray[i].substr(0,1));
			setTileValue(i, mainTileArray[i]);
			//console.log(mainTileArray[i].substr(1,1));
		}
    });
	

	io.on('connection', function (socket)
	{
		createClient(socket.id);
		for (var i=0; i < 40; i++)
		{
			getTileState(i, socket.id);
		}
	    socket.on('message', function(msg)
	    {
	        console.log("Message Received: ", msg);
	        socket.broadcast.emit('message', msg);
	    });
	    
	    socket.on('disconnect', function()
	    {
		    //clients[this.id] = null;
		    //console.log(clients);
		    deleteClient(this.id);
		    cleanseCurrentTile(socket.id);
	    });
	    
	    /**
	    **	User wants to show a tile.
	    **/
	    socket.on('tileShowRequest', function(tileId)
	    {
	    	redisClient.get(tileId+':tileTaken', function(err, res)
	    	{
		    	if(res == 'false')
		    	{
			    	console.log('tileShow: '+tileId);
			    	redisClient.get(socket.id+':currentTile', function(err, res)		// Get the current user's tile
			    	{
			    		if(res == 'null' || res == null)												// If the current user has no tile, else1
			    		{
					    	redisClient.get(tileId+':tileOwner', function(err, res)		// Get the owner of the tile the user wants
					    	{
						    	if (res == 'null')										// If the tile has no owner, else2
						    	{
							    	rentTile(tileId, socket.id);						// Take the tile
						    	}
						    	else
						    	{
							    	console.log('Tile already owned by: '+res);			// else2: Tell the user someone else owns the tile
						    	}
						    	redisClient.get(tileId+':tileOwner', function(err, res)	// Get the tile again
						    	{
							    	console.log('Tile now owned by: '+res);
							    	if(socket.id == res)								// If the user now owns the tile
							    	{
							    		//socket.emit('tileShow', tileId);				// Show them the tile
							    		setCurrentTile(socket.id, tileId);				// Assign it as their current tile
							    		//socket.broadcast.emit('tilePeek', tileId);		// Give the other users a peek
							    		tileShow(socket.id, tileId)
							    		for(var i=1; i<5; i++)
							    		{
							    			console.log('Enters loop');
								    		redisClient.get(socket.id+':tile'+i, function(err, res)	// If the tile is one of the user's
								    		{
								    			console.log('Redis works looking for '+socket.id+':tile');
								    			console.log('Error: '+err);
								    			console.log('Apparently '+tileId+' is not '+res);
									    		if(tileId == res)
									    		{
									    			console.log('If succeeds');
									    			redisClient.get(tileId+':tileValue', function(err, res)
									    			{
									    				console.log('Redis works again');
										    			io.sockets.emit('tileTaken', '{ "tileId": "'+tileId+'", "value": "'+res+'" }');	// Tell everyone it's taken
										    			setCurrentTile(socket.id, 'null');		// Set user's tile to null
										    			takeTile(tileId);						// Take the tile
										    			redisClient.incrby(socket.id+':score', 100+parseInt(currentTime*10/1000), function(err, res)
										    			{
											    			console.log(err);
											    			console.log(res);
										    			});
										    			testScoring(socket.id);
									    			});
									    			
									    		}
								    		});
							    		}
							    	}	
						    	});
					    	});
				    	}
				    	else
				    	{
				    		console.log('You already have a tile: ' + res);				// else1: tell the user they already have a tile
				    	}
			    	});
		    	}
	    	});
	    	
	    });
	    
	    /**
	    **	User wants to hide a tile
	    **/
	    socket.on('tileHideRequest', function(tileId)
	    {
	    	redisClient.get(tileId+':tileTaken', function(err, res)
	    	{
		    	if(res == 'false')
		    	{
				    console.log('You want to hide: '+tileId);
			    	redisClient.get(tileId+':tileOwner', function(err, res)				// Get the tile's current owner
			    	{
				    	if (res == socket.id)											// If the user is the owner, else1
				    	{
					    	returnTile(tileId, socket.id);								// Return the tile
					    	console.log('Server has released tile: '+tileId);
				    	}
				    	else															
				    	{
					    	console.log('Tile not owned by you, rather: '+res);			// else1: Tell them they can't return it
				    	}
				    	redisClient.get(tileId+':tileOwner', function(err, res)			// Get the tile again
				    	{
					    	console.log('Tile now owned by: '+res);
					    	if(res != socket.id)										// If the tile is no longer the user's
					    	{
					    		socket.emit('tileHide', tileId);						// Hide to the user
					    		socket.broadcast.emit('tileHide', tileId);				// Hide to everyone else
					    		setCurrentTile(socket.id, 'null')						// Set user's current tile to null
					    		console.log('Your current tile is now null');
					    	}
				    	});
			    	});
			    }
			});
	    });
	    
	});
	
});

function createClient(socketId)
{
	return redisClient.set(socketId+':clientName', 'null') &&
	redisClient.set(socketId+':tile1', 'null') &&
	redisClient.set(socketId+':tile2', 'null') &&
	redisClient.set(socketId+':tile3', 'null') &&
	redisClient.set(socketId+':tile4', 'null') &&
	redisClient.set(socketId+':currentTile', 'null') &&
	redisClient.set(socketId+':score', 0) && (clients[socketId] = socketId) && console.log('TEST');;
}

function setClientName(socketId, name)
{
	return redisClient.set(socketId+':clientName', name);
}

function setTiles(socketId, tiles)
{
	console.log('Giving user their tiles');
	console.log(socketId+':tiles');
	console.log(tiles);
	for(var i=1; i<=tiles.length; i++)
	{
		if (i<tiles.length)
			redisClient.set(socketId+':tile'+i, tiles[i-1]);
		else
			return redisClient.set(socketId+':tile'+i, tiles[i-1]);	
	}
	for(var i=1; i<=tiles.length; i++)
	{
		redisClient.get(socketId+':tile'+i, function(err, res)
		{
			console.log(res);
		});
	}
	 
}

function testScoring(socketId)
{
	return redisClient.get(socketId+':score', function(err, res)
	{
		console.log('Score: '+res);
	});
}

function setCurrentTile(socketId, tileId)
{
	return redisClient.set(socketId+':currentTile', tileId);
}

function cleanseCurrentTile(socketId)
{
	return redisClient.get(socketId+':currentTile', function(err, res)
	{
		if (res != null)
		{
			redisClient.set(res+':tileOwner', 'null');
			io.sockets.emit('tileHide', res);
		}
	});
}

function generateClientTiles()
{
	console.log('Generating tiles');
	return [Math.floor(Math.random()*40), Math.floor(Math.random()*40), Math.floor(Math.random()*40), Math.floor(Math.random()*40)];
}

function deleteClient(socketId)
{
	return redisClient.keys(socketId+"*", function (err, keys)
	{
		keys.forEach(function(key)
		{
			redisClient.del(key, function(err, num)
			{
				;
			});
		});
	}) && (clients[socketId] = null);
}

function createTile(tileId)
{
	return redisClient.set(tileId+':tileValue', 'null') &&
	redisClient.set(tileId+':tileColor', 'null') &&
	redisClient.set(tileId+':tileOwner', 'null') &&
	redisClient.set(tileId+':tileTaken', 'false');
}

function setTileColor(tileId, color)
{
	console.log('Setting color of '+tileId);
	return redisClient.set(tileId+':tileColor', color);
}

function setTileValue(tileId, value)
{
	return redisClient.set(tileId+':tileValue', value);
}

function rentTile(tileId, socketId)
{
	return redisClient.set(tileId+':tileOwner', socketId);
}

function takeTile(tileId)
{
	console.log('Taking: '+tileId);
	return redisClient.set(tileId+':tileTaken', 'true');
}

function returnTile(tileId, socketId)
{
	return redisClient.set(tileId+':tileOwner', 'null');
}

function getTileState(tileId, socketId)
{
	return redisClient.get(tileId+':tileTaken', function(err,res)
	{
		if(res == 'false')
		{
			redisClient.get(tileId+':tileOwner', function(err,res)
			{
				if(res == 'null')
					io.sockets.socket(socketId).emit('tileHide', tileId);
				else if(res == socketId)
					redisClient.get(tileId+':tileValue', function(err, res)
					{
						io.sockets.socket(socketId).emit('tileShow', '{ "tileId": "'+tileId+'", "value": "'+res+'" }');
					});
				else
					redisClient.get(tileId+':tileValue', function(err, res)
					{
						io.sockets.socket(socketId).emit('tilePeek', '{ "tileId": "'+tileId+'", "value": "'+res.substr(0,1)+'" }');
					});
			});
		}
		else
		{
			redisClient.get(tileId+':tileValue', function(err, res)
			{
				io.sockets.socket(socketId).emit('tileTaken', '{ "tileId": "'+tileId+'", "value": "'+res+'" }');
			});
			
		}
	});
}

function tileShow(socketId, tileId)
{
	redisClient.get(tileId+':tileValue', function(err, res)
	{
		io.sockets.socket(socketId).emit('tileShow', '{ "tileId": "'+tileId+'", "value": "'+res+'" }');
		io.sockets.socket(socketId).broadcast.emit('tilePeek', '{ "tileId": "'+tileId+'", "value": "'+res.substr(0,1)+'" }');
	});
}

function randomTileArray()
{
	var tileArray = new Array(40);
	var colorArray = new Array();
	colorArray[0] = 'R';
	colorArray[1] = 'G';
	colorArray[2] = 'B';
	colorArray[3] = 'Y';
	for(var i=0; i<40; i++)
	{
		var tileString = colorArray[Math.floor(i/10)];
		tileString += Math.floor(i%10);
		tileArray[i] = tileString;
	}
	for(var j, x, i = tileArray.length; i; j = parseInt(Math.random() * i), x = tileArray[--i], tileArray[i] = tileArray[j], tileArray[j] = x);
	return tileArray;
}

function runTimer(time)
{
	currentTime = ((time+1)*1000);
	var timer = setInterval(function()
	{
		currentTime -= 50;
		if(currentTime >= 0 && (currentTime/1000) == parseInt(currentTime/1000))
		{
			io.sockets.emit('timer', currentTime/1000);
		}
		else if(currentTime < 0)
		{
			clearInterval(timer);
			rebuildGame();
		}
	},50);
}

function rebuildGame()
{
	redisClient.flushall( function (didSucceed) {
        //console.log(didSucceed); // true
        io.sockets.emit('reset', '');
        console.log('SENDING RESET COMMAND');
        runTimer(30);
        console.log('RESTARTING TIMER');
        mainTileArray = randomTileArray();
        console.log('GENERATING ARRAY');
        for (var i=0; i < 40; i++)
		{
			console.log('LOOPING TO SET BOARD TILES');
			createTile(i);
			setTileColor(i, mainTileArray[i].substr(0,1));
			setTileValue(i, mainTileArray[i]);
		}
		var newArray = new Array();
		console.log('CREATE NEW ARRAY');
		for(var client in clients)
		{
			console.log('FOR EACH CLIENT');
			if(clients[client] != null)
			{
				newArray[client] = clients[client];
				console.log('ADD TO NEW ARRAY');
				createClient(clients[client]);
				console.log('GENERATE THE CLIENT');
				setTiles(clients[client], generateClientTiles());
				console.log('SET THEIR TILES');
				for (var i=0; i<40; i++)
				{
					console.log('LOOPING TO SEND TILES');
					getTileState(i, clients[client]);
				}
				redisClient.keys(clients[client]+":tile*", function (err, keys)
				{
					keys.forEach(function(key)
					{
						redisClient.get(key, function(err, res)
						{
							redisClient.get(res+':tileValue', function(err, res)
							{
								//console.log(key+': '+res);
								io.sockets.socket(clients[client]).emit('tile','{ "tileId": "'+key.substr(21,5)+'", "value": "'+res+'" }');
							});
						});
					});
				});
			}
		}
		clients = newArray;
		
    });
    
}