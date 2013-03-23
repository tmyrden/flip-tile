// reference the http module so we can create a webserver
var http = require("http"),
    socketio = require("socket.io"),
    redis = require("redis"),
    fs = require("fs"),
    redisClient = redis.createClient(6379, process.env.IP);


// create a server
var server = http.createServer(function(req, res) {
    res.writeHead(200, { 'Content-type': 'text/html'});
    // on every request, we'll output 'Hello world'
    res.end(fs.readFileSync(__dirname + '/index.html'));
}).listen(process.env.PORT, process.env.IP, function() { console.log('test')});

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