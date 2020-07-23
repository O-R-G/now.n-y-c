var express = require("express");
var cors = require('cors');
var fs = require('fs');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var moment = require('moment-timezone');


var app = express();
app.use(cors());

var dataFolder = __dirname + '/static/data/';
var cache_mtime = {};
var cache_filenames = [];

fs.readdir(dataFolder, (err, filenames) => {
	if(typeof filenames != 'undefined'){
		filenames.forEach(name => {
	    	var this_mtime = fs.statSync(dataFolder + name).mtime;
			cache_mtime[name] = this_mtime;
			cache_filenames.push(name);
		});
		call_request_json();
	}
});
// --------------  msgs.js -----------------
// date / time

Date.prototype.today = function () { 
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return days[this.getDay()] + " " + this.getDate() + " " + months[this.getMonth()] + " " + this.getFullYear();
}
Date.prototype.now = function () {
     return this.hour() + ":" + this.minute() +":"+ this.second();
}
Date.prototype.hour = function () {
     return ((this.getHours() < 10)?"0":"") + this.getHours();
}
Date.prototype.minute = function () {
     return ((this.getMinutes() < 10)?"0":"") + this.getMinutes();
}
Date.prototype.second = function () {
    return ((this.getSeconds() < 10)?"0":"") + this.getSeconds();
}

function get_time(d = false){
	if(!d)
    	var d = new Date();
	return [d.today().toUpperCase(), d.now().toUpperCase()];
}

var now = new Date();
var now_hr = now.hour();
var now_min = now.minute();

var req_array = [
	{	
		'name': 'new-york-times',
		'req_url': 'https://api.nytimes.com/svc/news/v3/content/all/all.json?api-key=FJ5pNfQtwlkTP27jg62s2De8IM0Ozvjk', 
		'data_type': 'json',
        'results_count': 3,
        'use_header': false,
        'cache_lifecycle': 1
	}
	,{	
		'name': 'covidtracking',
		'req_url': 'https://covidtracking.com/api/v1/states/current.json', 
		'data_type': 'json',
        'results_count': '',
        'use_header': true, 
        'cache_lifecycle': 10
	}
	,{	
		'name': '311',
		'req_url': 'https://data.cityofnewyork.us/resource/erm2-nwe9.json?$$app_token=LTyWtvrOoHffWyAwXcdEIQDup&$limit=2', 
		'data_type': 'json',
        'results_count': '',
        'use_header': true,
        'cache_lifecycle': 10
	}
	,{	
		'name': 'train',
		'req_url': "https://mtaapi.herokuapp.com/times?hour="+now_hr+"&minute="+now_min,
		'data_type': 'json',
        'results_count': '',
        'use_header': false,
        'cache_lifecycle': 1
	}
	,{
		'name':'population',
		'req_url': 'https://data.cityofnewyork.us/resource/xywu-7bv9.json',
		'data_type': 'json',
		'results_count': '',
		'use_header': false,
		'cache_lifecycle': 1440
	}
	,{
		'name':'hotspot',
		'req_url': 'https://data.cityofnewyork.us/resource/varh-9tsp.json',
		'data_type': 'json',
		'results_count': '',
		'use_header': false,
		'cache_lifecycle': 1440
	}
	,{
		'name':'restaurant-inspection',
		'req_url': 'https://data.cityofnewyork.us/resource/43nn-pn8j.json',
		'data_type': 'json',
		'results_count': '',
		'use_header': false,
		'cache_lifecycle': 1440
	}
	,{
		'name':'street-tree',
		'req_url': 'https://data.cityofnewyork.us/resource/uvpi-gqnh.json',
		'data_type': 'json',
		'results_count': '',
		'use_header': false,
		'cache_lifecycle': 1440
	}
	,{
		// https://aqicn.org/api/
		'name':'air-quality',
		'req_url': 'https://api.waqi.info/feed/newyork/?token=e0756365c32aba9371b4d126178465fba05bb6f5',
		'data_type': 'json',
		'results_count': '',
		'use_header': false,
		'cache_lifecycle': 1440
	}
	,{
		// https://data.cityofnewyork.us/Environment/Energy-Efficiency-Projects/h3qk-ybvt
		'name':'energy-efficiency-projects',
		'req_url': 'https://data.cityofnewyork.us/resource/h3qk-ybvt.json',
		'data_type': 'json',
		'results_count': '',
		'use_header': false,
		'cache_lifecycle': 1440
	}
	,{
		// https://data.cityofnewyork.us/Business/License-Applications/ptev-4hud
		'name':'DCA-license',
		'req_url': 'https://data.cityofnewyork.us/resource/ptev-4hud.json',
		'data_type': 'json',
		'results_count': '',
		'use_header': false,
		'cache_lifecycle': 1440
	}
	
];

var now_msg = get_time();
var msgs = 'initial', // the final msgs for display. array of letters
	msgs_sections = {}, // the kept msgs in the form of opening, mid, ending. it needs to stay array so that it has the flexibility to be updated.
	msgs_temp = []; // the intermediate msgs to hold updated msgs, and wait until the current frame is settled. 
var msgs_array = [], 
	msgs_array_temp = [];

msgs_sections['opening'] = [];
msgs_sections['opening'][0] = [];
msgs_sections['opening'][0].push('NEW YORK CONSOLIDATED'); 
msgs_sections['opening'][0].push('                     '); 
msgs_sections['opening'][0].push('                     '); 
msgs_sections['opening'][0].push('                     '); 
msgs_sections['opening'][0] = msgs_sections['opening'][0].join('');
msgs_sections['opening'][1] = [];
msgs_sections['opening'][1].push(now_msg[0]); 
msgs_sections['opening'][1].push(now_msg[1]); 
msgs_sections['opening'][1].push('–––––––––––––––––––––'); 
msgs_sections['opening'][1].push('—————————————————————'); 
msgs_sections['opening'][1] = msgs_sections['opening'][1].join('');

msgs_sections['mid'] = {};

msgs_sections['ending'] = ' 0 1 2 3 4 5 6 7 8 9 Have a nice day.';
var msgs_break = '///';

// 	only 47 chars cause one if left for the blinking block
var msgs_beginning = 'NEW YORK CONSOLIDATED                          '; 

// preventing from the animation starts before data loaded.
// if ready_now == 0 when an api is loaded, 
// it fires timer then reading_now++
// ( json.js )
var ready_now = 0;
var ready_full = req_array.length;

function handle_msgs(name, response, results_count = false){
	if(results_count == '')
		results_count = false;
	var response = response;
	var this_msgs = [];
	// opening msg for each section;
	if(name == 'new-york-times'){
		// console.log('updaing new-york-times');
		this_msgs = [' from the NYTimes : ' + msgs_break ];
		response = response['results'] ;
		for(i = 0 ; i < results_count ; i++){
			var this_msg = response[i]['title'];
			if(typeof this_msg != 'undefined')
				this_msgs.push(this_msg+msgs_break);
		}

	}else if(name == 'covidtracking'){
		// console.log('updaing covidtracking');
		this_msgs.push(' from covidtracking.com : ' + msgs_break);
		for(i = 0 ; i < response.length ; i++){
			if(response[i]['state'] == 'NY'){
				response = response[i];
				break;
			}
		}
		if(typeof response['positive'] != 'undefined')
			this_msgs.push('Positive cases: '+response['positive'] + msgs_break+' ');
		if(typeof response['negative'] != 'undefined')
			this_msgs.push('Negative cases: '+response['negative'] + msgs_break+' ');
		if(typeof response['hospitalizedCurrently'] != 'undefined')
			this_msgs.push('Currently hospitalized cases: '+response['hospitalizedCurrently'] + msgs_break+' ');

	}else if(name == '311'){
		for(i = 0 ; i < response.length ; i++){
        	var this_msg = ' from '+response[i]['agency']+': ';
        	this_msg += response[i]['descriptor']+' is reported around '+response[i]['landmark']+' ';
        	this_msgs.push( msgs_break+this_msg.toUpperCase()+msgs_break );
        }

	}
	else if(name == 'train'){
		this_msgs = [' There is a train arriving now at : ' + response['result'][0]['name'] + ". " + msgs_break ];
	}
	else if(name == 'population'){
		// console.log(response[0]);
		this_msgs = [' Total population in NYC: ' + response[0]['_2020']+". " + msgs_break ];
		for(i = 1 ; i <response.length ; i++ ){
			this_msgs.push(' Population in ' + response[i]['borough'].replace('   ', '') + ": " + response[i]['_2020']+"("+response[i]['_2020_boro_share_of_nyc_total']+"%)"+msgs_break );
		}
	}
	else if(name == 'hotspot'){
		var index = parseInt( response.length * Math.random() );
		var data_count = 0;
		this_msgs = [];
		while(data_count < 1){			
			if(response[index]['type'] == 'Free'){
				this_msgs.push(' Free public hotspot "'+response[index]['ssid']+'" at '+response[index]['location']);
				data_count++;
			}
			index = parseInt( response.length * Math.random() );
		}
	}
	else if(name == 'restaurant-inspection'){
		var index = parseInt( response.length * Math.random() );
		var data_count = 0;
		results_count = results_count ? results_count : 1;
		this_msgs = [];
		this_msgs = [' From DOHMH New York City Restaurant Inspection Results : ' ];
		
		while(data_count < results_count){
			if(response[index]['critical_flag'] == 'N' && response[index]['grade'] == 'A'){
				this_msgs.push(response[index]['dba'] + ' on '+ response[index]['street']+' is graded as A. '+msgs_break);
				data_count++;
			}
			index = parseInt( response.length * Math.random() );			
		}
	}
	else if(name == 'street-tree'){
		var index = parseInt( response.length * Math.random() );
		var data_count = 0;
		results_count = results_count ? results_count : 1;
		this_msgs = [];
		this_msgs = [' Street Tree in NYC : '];
		
		while(data_count < results_count){
			this_msgs.push(response[index]['spc_common'] + ' on '+ response[index]['address']+'. Diameter at Breast Height: '+response[index]['tree_dbh']+' in. '+msgs_break);
			data_count++;
			index = parseInt( response.length * Math.random() );			
		}
	}
	else if(name == 'air-quality'){
		var aqi = response['data']['aqi'];
		var level = '';
		if(aqi <= 50){
			level = 'GOOD';
		}else if(aqi <= 100){
			level = 'Moderate';
		}else if(aqi <= 150){
			level = 'Unhealthy for Sensitive Groups';
		}else if(aqi <= 200){
			level = 'Unhealthy';
		}else if(aqi <= 300){
			level = 'Very Unhealthy';
		}else{
			level = 'Hazardous';
		}
		this_msgs = [];
		this_msgs = [' Air Quality Index in New York : ' ];
		
		this_msgs.push(aqi + ' ('+ level+') '+msgs_break);
	}
	else if(name == 'energy-efficiency-projects'){
		var index = parseInt( response.length * Math.random() );
		var data_count = 0;
		results_count = results_count ? results_count : 1;
		this_msgs = [];
		this_msgs = [" The City's Energy Efficiency Projects: " ];
		while(data_count < results_count){
			if(response[index]['projectsitename'] && response[index]['primaryprojecttype']!='Other'){
				this_msgs.push(response[index]['primaryprojecttype'] + ' for '+ response[index]['projectsitename']+'. Status: '+response[index]['projectstatus']+' '+msgs_break);
				data_count++;
			}
			index = parseInt( response.length * Math.random() );			
		}
	}
	else if(name == 'DCA-license'){
		var index = parseInt( response.length * Math.random() );
		var data_count = 0;
		results_count = results_count ? results_count : 1;
		this_msgs = [];
		this_msgs = [" From DCA : Legally Operating Businesses License issued to" ];
		
		while(data_count < results_count){
			if(response[index]['status']=='Issued'){
				this_msgs.push(response[index]['business_name']+' '+msgs_break);
				data_count++;
			}
			index = parseInt( response.length * Math.random() );			
		}
	}
	var this_msgs_str = this_msgs.join();
	msgs_sections['mid'][name] = this_msgs_str;
	
	update_msgs();
}

function shuffle(array) {
    array.sort(() => Math.random() - 0.5);
}

function update_msgs(isBeginning = false){
	msgs_mid_array = Object.keys(msgs_sections['mid']).map(function (key) { 
        return msgs_sections['mid'][key]; 
    });
    
	if(isBeginning)
		shuffle(msgs_mid_array);

	msgs_temp = [msgs_sections['opening']];
	for(i = 0 ; i < msgs_mid_array.length ; i++){
		for(j = 0 ; j < msgs_mid_array[i].length ; j++)
			msgs_temp.push(msgs_mid_array[i][j]);
	}
	msgs_temp.push(msgs_sections['ending']);

	msgs_array_temp = msgs_temp;
	msgs_temp = msgs_temp.join('');
	msgs_temp = msgs_temp.toUpperCase();
	msgs_temp = msgs_temp.split('');
	msgs = msgs_temp.join('');
}

// this is different from update_msgs() (at least for now)
// update_msgs(): fired every whatever seconds setInverval sets;
// update_msgs_opening(): fired every time the msgs loop is done;
function update_msgs_opening(){
	now_msg = new Date().toString();
	msgs_sections['opening'][1] = [];
	// msgs_sections['opening'][1].push(now_msg[0]); 
	// msgs_sections['opening'][1].push(now_msg[1]); 
	msgs_sections['opening'][1].push(now_msg); 
    msgs_sections['opening'][1].push('–––––––––––––––––––––'); // en-dash (S)
    msgs_sections['opening'][1].push('—————————————————————'); // em-dash (L)
	msgs_sections['opening'][1] = msgs_sections['opening'][1].join('');
	msgs_temp[0] = msgs_sections['opening'][0].concat(msgs_sections['opening'][1]);
}
// -------------  end msgs.js ---------------------

// -------------  json.js     ---------------------
Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

function request_json(name, request_url, data_type, results_count = false, use_header = true, cache_lifecycle = false) {
    var json = '';
    var hasCache = ( cache_filenames.indexOf(name+'.'+data_type) != -1 ) ? true : false;
    var this_mtime = cache_mtime[name+'.'+data_type];
    var now_timestamp = new Date().getTime();
    now_timestamp = parseInt(now_timestamp/1000); // ms to s
    if(cache_lifecycle){
    	cache_lifecycle = cache_lifecycle * 60;
    }

    if( (cache_lifecycle && now_timestamp - this_mtime > cache_lifecycle) || !cache_lifecycle || !hasCache){
    	request_live(name, request_url, data_type, results_count, use_header, hasCache, now_timestamp);

    }else{
    	request_cache(name, data_type, results_count);
    }

}

function request_live(name, request_url, data_type,results_count = false, use_header = true, hasCache, now_timestamp, cache_lifecycle = false){
	var counter = 0;
	var counter_max = 3;
	
    var httpRequest = new XMLHttpRequest();
	
	httpRequest.onreadystatechange = function(){
		
		if (httpRequest.readyState === 4) {
	      if (httpRequest.status === 200) {	
	      	if(counter > counter_max && hasCache && cache_lifecycle){
	      		// request_cache(name, data_type, results_count);
	      	}
      		if(data_type == 'json'){
      			var response = JSON.parse(httpRequest.responseText);
      		}else if(data_type == 'xml'){
      			var response = httpRequest.responseText;
      		}
      		if(response){
      			now_timestamp = new Date().getTime();
    			now_timestamp = parseInt(now_timestamp/1000); // ms to s
      			update_cache(name, response, data_type, now_timestamp); // updat
      			handle_msgs(name, response, results_count); // static/js/msg.js
	        	cache_mtime[name+'.'+data_type] = now_timestamp;
	        	ready_now++;
      		}
	      	counter++;
	      } else {
	      	if(hasCache){
	      		console.log('status !== 200, use cached file for '+name);
	      		request_cache(name, data_type, results_count);
	      	}else{
	      		console.log('please check the request url');
	      	}
	      }
	    }
	};
	httpRequest.open('GET', request_url);
	if(use_header)
		httpRequest.setRequestHeader('Content-Type', 'application/'+data_type);

	httpRequest.send();
}

function update_cache(cache_filename = '', response, data_type, now_timestamp){
	var cache_path = __dirname + '/static/data/'+cache_filename+'.'+data_type;
	response = JSON.stringify(response);
	fs.writeFile(cache_path, response, function(err, result) {
		if(err) console.log('error', err);
	});
	
	cache_mtime[cache_filename+'.'+data_type] = now_timestamp;
}
	
function request_cache(cache_filename = '', data_type, results_count = false){
	var req_url = __dirname + '/static/data/'+cache_filename+'.'+data_type;
	var this_cache = fs.readFileSync(req_url);
	this_cache = JSON.parse(this_cache);
	var this_last_updated = fs.statSync(req_url).mtime;
	this_last_updated = parseInt(new Date(this_last_updated).getTime()/1000);
	if(this_last_updated != cache_mtime[cache_filename+'.'+data_type])
	    cache_mtime[cache_filename+'.'+data_type] = this_last_updated;
	ready_now++;
	handle_msgs(cache_filename, this_cache, results_count);
}

// -------------  end json.js     -----------------

// -------------  call_request_json.js     --------

function call_request_json(){
	now = new Date();
	now_hr = now.hour();
	now_min = now.minute();

    for(var i = 0 ; i < req_array.length ; i++){
    	if(req_array[i]['name'] == 'train')
    		req_array[i]['req_url'] = "https://mtaapi.herokuapp.com/times?hour="+now_hr+"&minute="+now_min;
    	request_json(req_array[i]['name'], req_array[i]['req_url'], req_array[i]['data_type'], req_array[i]['results_count'], req_array[i]['use_header'], req_array[i]['cache_lifecycle'] );
    }
}
// -------------  end call_request_json.js  ----

app.listen(3000, () => {
	console.log("Server running on port 3000");
});

app.get("/now", (req, res, next) => {
	var now = new Date().getTime();
	var now_ny_temp = moment(now);
	var now_ny_temp2 = now_ny_temp.tz("America/New_York").format();
	var now_ny = get_time(now_ny_temp2);
	var char_num = 48;
	var delay_ms = 3000;
	var screen_interval = 5600; // 50 ms * 52 + 1000 ms
	var msgs_length = msgs.length;
	var full_loop_ms = (parseInt(msgs_length / char_num) + 1) * screen_interval ;
	var position = now % full_loop_ms;
	position = parseInt ( position / screen_interval ) * char_num;
	update_msgs_opening();
	var msgs_opening = msgs_sections['opening'];
	if(position == 0)
		update_msgs(true);
	else
		update_msgs();
	now = now/1000; // seconds since 1970 unix time
	res.json({ now: now, msgs: msgs, position: position, delay_ms: delay_ms, screen_interval: screen_interval, full_loop_ms: full_loop_ms, msgs_beginning: msgs_beginning, msgs_opening: msgs_opening, now_ny: now_ny });
});
