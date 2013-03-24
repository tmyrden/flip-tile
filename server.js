var http = require("http"),
    socketio = require("socket.io"),
    redis = require("redis"),
    fs = require("fs");
    
var board = new Board();
board.generate();

var clients = new Array();

var redisClient = redis.createClient(6379, 'nodejitsudb6390461707.redis.irstack.com');
redisClient.auth("nodejitsudb6390461707.redis.irstack.com:f327cfe980c971946e80b8e975fbebb4", function(err) {
  if (err) {
    throw err;
  }
});
redisClient.on('ready', function () {
	runTimer(20);
});

var server = http.createServer(function(req, res) {
    res.writeHead(200, { 'Content-type': 'text/html'});
    res.end(fs.readFileSync(__dirname + '/index.html'));
}).listen(8080);

var io = socketio.listen(server);

io.on('connection', function (socket)
{
	var newClient = new Client();
	newClient.setId(socket.id);
	clients[socket.id] = newClient;
    socket.on('message', function(msg)
    {
        console.log("Message Received: ", msg);
        socket.broadcast.emit('message', msg);
    });
    
    socket.on('disconnect', function()
    {
	    clients[this.id] = null;
	    console.log(clients);
    });
    
    socket.on('tileShowRequest', function(coords)
    {
	    var rowCol = JSON.parse(coords);
	    var reqTile = board.getTile(rowCol['row'], rowCol['column']);
	    socket.broadcast.emit('tilePeek',reqTile.getBroadcastJSON());
	    socket.emit('tileShow',reqTile.getSocketJSON());
    });
    
    socket.on('tileHideRequest', function(coords)
    {
	    var rowCol = JSON.parse(coords);
	    var reqTile = board.getTile(rowCol['row'], rowCol['column']);
	    socket.broadcast.emit('tileHide',reqTile.getBroadcastJSON());
	    socket.emit('tileHide',reqTile.getSocketJSON());
    });
    
});

function Client()
{
	this.id = null;
	this.name = null;
	this.tiles = null;
	
	this.setId = setId;
	function setId(id)
	{
		this.id = id;
	}
	
	this.getId = getId;
	function getId()
	{
		return this.id;
	}
	
	this.setName = setName;
	function setName(name)
	{
		this.name = name;
	}
	
	this.getName = getName;
	function getName()
	{
		return this.name;
	}
	
	this.setTiles = setTiles;
	function setTiles(tiles)
	{
		this.tiles = tiles;
	}
	
	this.getTiles = getTiles;
	function getTiles()
	{
		return this.tiles;
	}
}

function Tile()
{
	this.color = null;
	this.number = null;
	this.row = null;
	this.column = null;
	
	this.setColor = setColor;
	function setColor(color)
	{
		this.color = color;
	}
	
	this.getColor = getColor;
	function getColor()
	{
		return this.color;
	}
	
	this.setNumber = setNumber;
	function setNumber(number)
	{
		this.number = number;
	}
	
	this.getNumber = getNumber;
	function getNumber()
	{
		return this.number;
	}
	
	this.setRow = setRow;
	function setRow(row)
	{
		this.row = row;
	}
	
	this.getRow = getRow;
	function getRow()
	{
		return this.row;
	}
	
	this.setColumn = setColumn;
	function setColumn(column)
	{
		this.column = column;
	}
	
	this.getColumn = getColumn;
	function getColumn()
	{
		return this.column;
	}
	
	this.getBroadcastJSON = getBroadcastJSON;
	function getBroadcastJSON()
	{
		return "Broadcast JSON";
	}
	
	this.getSocketJSON = getSocketJSON;
	function getSocketJSON()
	{
		return "Socket JSON";
	}
}

function Board()
{
	this.board = new Array(5);
	for (var i=0; i < this.board.length; i++)
	{
		this.board[i] = new Array(8);
	}
	
	this.getBoard = getBoard;
	function getBoard()
	{
		return this.board;
	}
	
	this.generate = generate;
	function generate()
	{
		for(var i=0; i<this.board.length; i++)
		{
			for(var j=0; j<this.board[i].length; j++)
			{
				this.board[i][j] = new Tile();
				this.board[i][j].setRow(i);
				this.board[i][j].setColumn(j);
				this.board[i][j].setColor(Math.floor((Math.random()*3)+1));
				this.board[i][j].setNumber(Math.floor((Math.random()*10)+1));
			}
		}
		return JSON.stringify(board);
	}
	
	this.getTile = getTile;
	function getTile(row, column)
	{
		return this.board[row][column];
	}
}

function Round()
{
	this.id = null;
	this.clients = null;
	this.board = null;
	
	this.setId = setId;
	function setId(id)
	{
		this.id = id;
	}
	
	this.getId = getId;
	function getId()
	{
		return this.id;
	}
	
	this.setClients = setClients;
	function setClients(clients)
	{
		this.clients = clients;
	}
	
	this.getClients = getClients;
	function getClients()
	{
		return this.clients;
	}
}

function runTimer(time)
{
	redisClient.set('timer',time+1);
	var timer = setInterval(function(){
		redisClient.decr('timer', function(err, res)
		{
			if(res > 0)
				io.sockets.emit('timer',res);
			else
			{
				clearInterval(timer);
				runTimer(20);
			}
		});
	}, 1000);
}