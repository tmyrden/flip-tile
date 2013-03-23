// reference the http module so we can create a webserver
var http = require("http"),
    socketio = require("socket.io"),
    redis = require("redis"),
    fs = require("fs");
    
var redisClient = redis.createClient(6379, 'nodejitsudb6390461707.redis.irstack.com');
redisClient.auth("nodejitsudb6390461707.redis.irstack.com:f327cfe980c971946e80b8e975fbebb4", function(err) {
  if (err) {
    throw err;
  }
});
redisClient.on('ready', function () {
	
});


// create a server
var server = http.createServer(function(req, res) {
    res.writeHead(200, { 'Content-type': 'text/html'});
    // on every request, we'll output 'Hello world'
    res.end(fs.readFileSync(__dirname + '/index.html'));
}).listen(8080);

var io = socketio.listen(server);

io.on('connection', function (socket)
{
    socket.send("Welcome!");
    socket.on('message', function(msg)
    {
        console.log("Message Received: ", msg);
        socket.broadcast.emit('message', msg);
    });
});

setInterval(function ()
{
    io.sockets.emit('message', 'test123');
}, 5000);