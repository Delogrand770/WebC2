var module = module || {};

var settings = {
	ip: "10.0.0.133",
	port: 80,
	getServer:function(){
		return "http://" + settings.ip + ":" + settings.port + "/";
	}
};

module.exports = {
	ip: settings.ip,
	port: settings.port,
	getServer: settings.getServer,
}
