Install Ubuntu (14.04) Server

settings.js - Contains the ip and port of the server listening for beacons. When you change a setting and start the server it will auto create new beacons reflecting the new settings. The settings.js is also loaded to the web interface.

server.js - Contains the authCode variable which is the code that needs to be entered to send admin commands to the server. The beacons can always talk to the server regardless of this variable value.


apt-get install nodejs
apt-get install curl

Start a server with screen and file logging: nodejs server.js | tee log

When the server starts it will generate a production (beacon) and test beacon (testScript)
chmod +x beacon or chmod +x testScript

./testScript will start a instance of the server and setup a beacon on the server to respond to requests.
./beacon will setup a beacon that responds to the server.

Right now the beacon identifies by hostname. You can easily change this in the beacon itself. Change the line that looks like below to a different identifying command. Beacons can use different methods of identification so long as the resulting command has no spaces or weird characters
	b=b=`hostname`
	
The beacons are Linux only and the machines need to have curl installed.
