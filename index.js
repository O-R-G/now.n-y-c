process.env.TZ = 'America/New_York';
require('dotenv').config();
var express = require("express");
var cors = require('cors');
var fs = require('fs');
const url = require('url');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
// var moment = require('moment-timezone');

var app = express();
app.use(cors());

var supported_lang = ['en', 'zh'];

/* 
	cache_time is the last modified time of english jsons. 
	whether it needs to request live depends solely on last modified time of the enlish json.
	even a user is checking other language, it still checks if the english json expires or not
	cache_time = {
		'en':{
			'nyt': 12324422...,
			'train': 43216365...,
			...
		}
		'zh:'{
			'nyt': 134454822...,
			'train': 31816765...,
			...
		}
		...
	}
*/
var cache_mtime = {};

/* 
	cache_filenames = {
		'en': ['nty.json', 'train.json',...],
		'zh': ['nty.json', 'train.json',...],
		...
	}
*/
var cache_filenames = {};

var handled_response = {};

supported_lang.forEach(function(el){
	cache_filenames[el] = [];
	cache_mtime[el] = {};
	handled_response[el] = {};
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
        'cache_lifecycle': 10
	}
	,{	
		'name': 'covidtracking',
		'req_url': 'https://api.covidtracking.com/v1/states/current.json', 
		'data_type': 'json',
        'results_count': '',
        'use_header': true, 
        'cache_lifecycle': 10
	}
	,{	
		'name': '311',
		'req_url': "https://data.cityofnewyork.us/resource/erm2-nwe9.json?$$app_token=LTyWtvrOoHffWyAwXcdEIQDup&$where=agency not like 'NYPD'&$limit=2", 
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
	// ,{
	// 	'name':'restaurant-inspection',
	// 	'req_url': 'https://data.cityofnewyork.us/resource/43nn-pn8j.json',
	// 	'data_type': 'json',
	// 	'results_count': '',
	// 	'use_header': false,
	// 	'cache_lifecycle': 1440
	// }
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
	,{
		'name':'weather',
		'req_url': 'https://api.weather.gov/gridpoints/OKX/33,37/forecast',
		'data_type': 'json',
		'results_count': '',
		'use_header': false,
		'cache_lifecycle': 1
	}
	
];


var now_msg = get_time();
var msgs = 'initial', // the final msgs for display. array of letters
	msgs_sections = {}, // the kept msgs in the form of opening, mid, ending. it needs to stay array so that it has the flexibility to be updated.
	msgs_temp = []; // the intermediate msgs to hold updated msgs, and wait until the current frame is settled. 
var msgs_array = [];

msgs_sections['opening'] = [];
msgs_sections['opening'][0] = [];
msgs_sections['opening'][0].push('NEW YORK CONSOLIDATED   '); 
msgs_sections['opening'][0].push('                        '); 
// msgs_sections['opening'][0].push('                     '); 
// msgs_sections['opening'][0].push('                     '); 
msgs_sections['opening'][0] = msgs_sections['opening'][0].join('');
var now_temp_1 = now_msg[0];
var length_temp = now_temp_1.length;
while(length_temp % 24 != 0)
{
	now_temp_1 += ' ';
	length_temp = now_temp_1.length;
}
var now_temp_2 = now_msg[1];
length_temp = now_temp_2.length;
while(length_temp % 24 != 0)
{
	now_temp_2 += ' ';
	length_temp = now_temp_2.length;
}
msgs_sections['opening'][1] = now_temp_1 + now_temp_2;
msgs_sections['opening'][1] += '––––––––––––––––––––––––';
msgs_sections['opening'][1] += '————————————————————————';

msgs_sections['mid'] = {};

msgs_sections['ending'] = ' 0 1 2 3 4 5 6 7 8 9 Have a nice day.';
var msgs_break = '///';

// 	only 47 chars cause one if left for the blinking block
var msgs_beginning = 'NEW YORK CONSOLIDATED                           '; 

// preventing from the animation starts before data loaded.
// if ready_now == 0 when an api is loaded, 
// it fires timer then reading_now++
// ( json.js )
var ready_now = 0;
var ready_full = req_array.length;

function handle_msgs(name, response, results_count = false, lang, formatted=false){
	if(results_count == '')
		results_count = false;
	var response = response;
	var this_msgs = '';
	// opening msg for each section;
	if(!formatted)
	{
		if(name == 'new-york-times'){
			this_msgs = ' from the NYTimes : ' + msgs_break ;
			response = response['results'] ;
			for(i = 0 ; i < results_count ; i++){
				var this_msg = response[i]['title'];
				if(typeof this_msg != 'undefined')
					this_msgs += (this_msg+msgs_break);
			}
		}else if(name == 'covidtracking'){
			this_msgs = ' from covidtracking.com : ' + msgs_break;
			for(i = 0 ; i < response.length ; i++){
				if(response[i]['state'] == 'NY'){
					response = response[i];
					break;
				}
			}
			if(typeof response['positive'] != 'undefined')
				this_msgs += 'Positive cases: '+response['positive'] + msgs_break+' ';
			if(typeof response['negative'] != 'undefined')
				this_msgs += 'Negative cases: '+response['negative'] + msgs_break+' ';
			if(typeof response['hospitalizedCurrently'] != 'undefined')
				this_msgs += 'Currently hospitalized cases: '+response['hospitalizedCurrently'] + msgs_break+' ';

		}else if(name == '311'){
			for(i = 0 ; i < response.length ; i++){
	        	var this_msg = ' from '+response[i]['agency']+': ';
	        	this_msg += response[i]['descriptor']+' is reported ';
	        	if(response[i]['landmark'] != undefined)
	        		'around '+response[i]['landmark']+' ';
	        	else
	        		'in '+response[i]['city']+' ';
	        	this_msgs += msgs_break+this_msg+msgs_break;
	        }
		}
		else if(name == 'train'){
			this_msgs = ' There is a train arriving now at : ' + response['result'][0]['name'] + msgs_break;
		}
		else if(name == 'population'){
			this_msgs = ' Total population in NYC: ' + response[0]['_2020']+". " + msgs_break;
			for(i = 1 ; i <response.length ; i++ ){
				this_msgs += ' Population in ' + response[i]['borough'].replace('   ', '') + ": " + response[i]['_2020']+"("+response[i]['_2020_boro_share_of_nyc_total']+"%)"+msgs_break;
			}
		}
		else if(name == 'hotspot'){
			// var index = parseInt( response.length * Math.random() );
			var index = 0;
			var data_count = 0;
			while(data_count < 1){			
				if(response[index]['type'] == 'Free'){
					this_msgs += ' Free public hotspot "'+response[index]['ssid']+'" at '+response[index]['location'];
					data_count++;
				}
				// index = parseInt( response.length * Math.random() );
				index++;
			}
		}
		// else if(name == 'restaurant-inspection'){
		// 	// var index = parseInt( response.length * Math.random() );
		// 	var index = 0;
		// 	var data_count = 0;
		// 	results_count = results_count ? results_count : 1;
		// 	this_msgs += ' From DOHMH New York City Restaurant Inspection Results : ';
			
		// 	while(data_count < results_count){
		// 		if(response[index]['critical_flag'] == 'N' && response[index]['grade'] == 'A'){
		// 			this_msgs += response[index]['dba'] + ' on '+ response[index]['street']+' is graded as A. '+msgs_break;
		// 			data_count++;
		// 		}
		// 		// index = parseInt( response.length * Math.random() );
		// 		index++;			
		// 	}
		// }
		else if(name == 'street-tree'){
			// var index = parseInt( response.length * Math.random() );
			var index = 0;
			var data_count = 0;
			results_count = results_count ? results_count : 1;
			this_msgs += ' Street Tree in NYC : ';
			while(data_count < results_count){
				this_msgs += response[index]['spc_common'] + ' on '+ response[index]['address']+'. Diameter at Breast Height: '+response[index]['tree_dbh']+' in. '+msgs_break;
				data_count++;
				index = parseInt( response.length * Math.random() );			
			}
		}
		else if(name == 'air-quality'){
			if(response['data'] == undefined)
			{
				console.log("handle_msg(air-quality): response['data'] == undefined");
				return false;
			}
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
			this_msgs += ' Air Quality Index in New York : ' ;
			
			this_msgs += aqi + ' ('+ level+') '+msgs_break;
		}
		else if(name == 'energy-efficiency-projects'){
			// var index = parseInt( response.length * Math.random() );
			var index = 0;
			var data_count = 0;
			results_count = results_count ? results_count : 1;
			this_msgs += " The City's Energy Efficiency Projects: ";
			while(data_count < results_count){
				if(response[index]['projectsitename'] && response[index]['primaryprojecttype']!='Other'){
					this_msgs += response[index]['primaryprojecttype'] + ' for '+ response[index]['projectsitename']+'. Status: '+response[index]['projectstatus']+' '+msgs_break;
					data_count++;
				}
				// index = parseInt( response.length * Math.random() );
				index++;			
			}
		}
		else if(name == 'DCA-license'){
			// var index = parseInt( response.length * Math.random() );
			var index = 0;
			var data_count = 0;
			results_count = results_count ? results_count : 1;
			this_msgs += " From DCA : Legally Operating Businesses License issued to";
			
			while(data_count < results_count){
				if(response[index]['status']=='Issued'){
					this_msgs += response[index]['business_name']+' '+msgs_break;
					data_count++;
				}
				// index = parseInt( response.length * Math.random() );	
				index++;		
			}
		}
		else if(name == 'weather')
		{
			if(response['properties'] != undefined)
			{
				this_msgs += " Today's weather in NYC: ";
				var weather_data_now = response['properties']['periods'][0]['detailedForecast'];
				console.log('weather data updated at: '+response['properties']['updated']);
				this_msgs += weather_data_now;
				this_msgs += msgs_break;
			}
			else{
				console.log('handle_msg(weather): response["properties"] == undefined');
				return false;
			}
		}
	}
	else
		this_msgs = response;
	
	msgs_sections['mid'][name] = this_msgs;
	// console.log(this_msgs)
	return this_msgs;
}

function shuffle(array) {
    array.sort(() => Math.random() - 0.5);
}

function paste_msgs(req_array){
	msgs_temp = msgs_sections['opening'][0] + msgs_sections['opening'][1];
	for(i = 0; i < req_array.length; i++){
		var this_key = req_array[i]['name'];
		msgs_temp += msgs_sections['mid'][this_key];
	}
	msgs_temp += msgs_sections['ending'];
	msgs_temp = msgs_temp.toUpperCase();
	msgs_temp = msgs_temp.split('');
	msgs = msgs_temp.join('');

}

// this is different from update_msgs() (at least for now)
// update_msgs(): fired every whatever seconds setInverval sets;
// update_msgs_opening(): fired every time the msgs loop is done;
function update_msgs_opening(now_ny){
	
	var now_temp_1 = now_ny[0];
	var length_temp = now_temp_1.length;
	while(length_temp % 24 != 0)
	{
		now_temp_1 += ' ';
		length_temp = now_temp_1.length;
	}
	var now_temp_2 = now_ny[1];
	length_temp = now_temp_2.length;
	while(length_temp % 24 != 0)
	{
		now_temp_2 += ' ';
		length_temp = now_temp_2.length;
	}
	msgs_sections['opening'][1] = now_temp_1 + now_temp_2;
	msgs_sections['opening'][1] += '––––––––––––––––––––––––';
	msgs_sections['opening'][1] += '————————————————————————';

	msgs_temp[0] = msgs_sections['opening'][0].concat(msgs_sections['opening'][1]);
}
// -------------  end msgs.js ---------------------

// -------------  json.js     ---------------------
Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

function request_json(name, request_url, data_type, results_count = false, use_header = true, cache_lifecycle = false, lang) {
    // console.log('=====  '+name+'  =====');
    var json = '';
    var hasCache = ( cache_filenames[lang].includes(name+'.txt') != -1 ); // whether it has cache of the specified language
    var hasEnCache = ( cache_filenames['en'].includes(name+'.txt') != -1 ); // whether it has cache of english
    var this_en_mtime = cache_mtime['en'][name+'.txt']; // m time of the enslish json
    var this_mtime = cache_mtime[lang][name+'.txt'];
    // this_en_mtime = parseInt(this_en_mtime/1000);
    // this_mtime = parseInt(this_mtime/1000);
    if(lang == 'en'){
    	this_en_mtime = this_mtime;
    	hasEnCache = hasCache;
    }
    var now_timestamp = new Date().getTime();
    now_timestamp = parseInt(now_timestamp/1000); // ms to s
    if(cache_lifecycle){
    	cache_lifecycle = cache_lifecycle * 60;
    }
    
    // console.log('cache expired: '+ (now_timestamp - this_mtime > cache_lifecycle));
    if( (cache_lifecycle && (now_timestamp - this_en_mtime > cache_lifecycle)) || !cache_lifecycle || !hasEnCache){
    	// 1. the english json is expired
    	// 2. cache_lifecycle is set to false
    	// 3. there's no english json
    	if( cache_lifecycle && (now_timestamp - this_en_mtime > cache_lifecycle) ){
    		console.log("the english cache of "+name+" is expired. request_live...");
    	}
    	else if(!cache_lifecycle)
    		console.log("cache_lifecycle of "+name+" is set to false. request_live...");
    	else if(!hasEnCache)
    		console.log("there's no english cache of "+name+". request_live...");
		request_live(name, request_url, data_type, results_count, use_header, hasCache, now_timestamp, false, lang);
    }else{
    	if( this_mtime < this_en_mtime - 100 )
    		request_english_cache(name, 'txt', results_count, lang);
    	else{
    		request_cache(name, 'txt', results_count, lang);
    	}
    }

}

function request_live(name, request_url, data_type,results_count = false, use_header = true, hasCache, now_timestamp, cache_lifecycle = false, lang){
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

      			try{	
      				var response_en = JSON.parse(httpRequest.responseText);
      			}
      			catch(err)
      			{
      				console.log('Error!');
      				console.log('Data from '+request_url+' cant be parsed into JSON.');
      				return false;
      			}
      		}else if(data_type == 'xml'){
      			var response_en = httpRequest.responseText;
      		}
      		if(response_en){
      			var handled_response_en = handle_msgs(name, response_en, results_count, lang); // static/js/msg.js
      			if(!handled_response_en)
      			{
      				request_cache(name, 'txt', results_count, lang);
      				return false;
      			}

      			if(lang == 'en')
      			{
      				handled_response[lang][name] = handled_response_en;
      				// console.log(handled_response[lang][name]);
      				now_timestamp = new Date().getTime();
    				now_timestamp = parseInt(now_timestamp/1000); // ms to s
    				update_cache(name, handled_response[lang][name], 'txt', now_timestamp, lang); // update lang cache
    				// cache_mtime[lang][name+'.'+data_type] = now_timestamp; // update lang mtime
      			}
      			else
      			{
      				translate_msgs(handled_response_en, lang, name).then(translated => {
					    now_timestamp = new Date().getTime();
    					now_timestamp = parseInt(now_timestamp/1000); // ms to s
    					update_cache(name, handled_response[lang][name], 'txt', now_timestamp, lang); // update lang cache
    					update_cache(name, handled_response_en, 'txt', now_timestamp, 'en'); // update en cache
				    }).catch(err => {
				        console.error(err);
				        res.send(err);
				        return false;
				    });

      			}
      			ready_now++;
      		}
	      	counter++;
	      } else {
	      	if(hasCache){
	      		console.log('status !== 200, use cached file for '+name);
	      		request_cache(name, 'txt', results_count, lang);
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

function update_cache(cache_filename = '', handled_response, cache_data_type='txt', now_timestamp, lang){
	var cache_path = __dirname + '/static/data/'+lang+'/'+cache_filename+'.'+cache_data_type;
	fs.writeFile(cache_path, handled_response, function(err, result) {
		if(err) console.log('error', err);
	});
	
	cache_mtime[lang][cache_filename+'.'+cache_data_type] = now_timestamp;
}
	
function request_cache(cache_filename = '', cache_data_type="txt", results_count = false, lang){
	var req_url = __dirname + '/static/data/'+lang+'/'+cache_filename+'.'+cache_data_type;
	console.log('request_cache(): '+req_url);
	fs.access(req_url, fs.F_OK, (err) =>{
		if(err){
			console.log('request_cache(): cant find cached file '+cache_filename+ ' of '+lang);
			request_live(name, request_url, data_type, results_count, use_header, hasCache, now_timestamp, false, lang);
			return false;
		}
		else
		{
			console.log('request_cache(): file exists');
			var this_cache = fs.readFileSync(req_url);
			var this_last_updated = fs.statSync(req_url).mtime;
			this_last_updated = parseInt(new Date(this_last_updated).getTime()/1000);
			if(this_last_updated != cache_mtime[cache_filename+'.'+cache_data_type])
			    cache_mtime[cache_filename+'.'+cache_data_type] = this_last_updated;
			var handled = handle_msgs(cache_filename, this_cache, results_count, lang, true);
			if(handled == false){
				console.log('request_cache(): fail to handle_msgs()');
				return false;
			}	
			else{
				ready_now++;
				return true;
			}
		}
	});
}
function request_english_cache(cache_filename = '', cache_data_type="txt", lang){
	var req_url = __dirname + '/static/data/'+lang+'/'+cache_filename+'.'+cache_data_type;
	var req_url_en = __dirname + '/static/data/en/'+cache_filename+'.'+cache_data_type;
	fs.access(req_url_en, fs.F_OK, (err) =>{
		if(err){
			console.log('request_english_cache(): cant find cached file '+cache_filename+ ' of '+lang);
			// request_live(name, request_url, data_type, results_count, use_header, hasCache, now_timestamp, false, 'en');
			return false;
		}
		else
		{
			console.log('request_english_cache(): file exists');
			var this_cache_en = fs.readFileSync(req_url_en);
			translate_msgs(this_cache_en, lang, name).then(translated => {
				var handled = handle_msgs(cache_filename, handled_response[lang][cache_filename], results_count, lang, true);
			    now_timestamp = new Date().getTime();
				now_timestamp = parseInt(now_timestamp/1000); // ms to s
				update_cache(name, handled_response[lang][name], 'txt', now_timestamp, lang); // update lang cache
		    }).catch(err => {
		        console.error(err);
		        res.send(err);
		        return false;
		    });
		}
	});
}
// -------------  end json.js     -----------------

// -------------  call_request_json.js     --------

function call_request_json(lang='en'){
	now = new Date();
	now_hr = now.hour();
	now_min = now.minute();

    for(var i = 0 ; i < req_array.length ; i++){
    	if(req_array[i]['name'] == 'train')
    		req_array[i]['req_url'] = "https://mtaapi.herokuapp.com/times?hour="+now_hr+"&minute="+now_min;
    	request_json(req_array[i]['name'], req_array[i]['req_url'], req_array[i]['data_type'], req_array[i]['results_count'], req_array[i]['use_header'], req_array[i]['cache_lifecycle'], lang );
    }
}
// -------------  end call_request_json.js  ----



// translate

const {Translate} = require('@google-cloud/translate').v2;
// const translate = new Translate();
const translate = new Translate(
	{
		projectId: 'n-y-c-translate',
		keyFilename: 'n-y-c-translate-16af2257bbb4.json'
	});

async function translate_msgs(text, target, name) {
	console.log('Translating '+name+' into '+target+'...');
    let [translations] = await translate.translate(text, target);
    translations = Array.isArray(translations) ? translations : [translations];
    translations.forEach((translation, i) => {
    	handled_response[target][name] = translation;
    });
}

app.listen(3000, () => {
	console.log("Server running on port 3000");
});

app.get("/now", (req, res, next) => {
	var dataFolder = __dirname + '/static/data/';
	// get language from query string
	const queryObject = url.parse(req.url,true).query;
	var lang = 'en';
  	if(queryObject['lang'] != undefined)
  	{
  		lang = queryObject['lang'];
  	}
  	console.log('lang = '+lang);
  	var dataFolder_en = dataFolder + 'en' + '/';
  	dataFolder = dataFolder + lang + '/';

    // load cached	
	fs.readdir(dataFolder, (err, filenames) => {
		if(typeof filenames != 'undefined'){
			req_array.forEach(req => {
				var name = req['name']+'.txt';
				// if(!filenames.includes(name)){
				// 	console.log('new data: '+req['name']);
				// 	new_data.push(req['name']);
				// }
				try {
				  var this_statSync = fs.statSync(dataFolder + name);
				  cache_mtime[lang][name] = this_statSync.mtime;
				}
				catch(err) {
				    cache_mtime[lang][name] = 0;
				}
			});
			filenames.forEach(name=>{
				cache_filenames[lang].push(name);
			});
			if(lang == 'en')
				call_request_json(lang);
			else
			{
				fs.readdir(dataFolder_en, (err, filenames) => {
					if(typeof filenames != 'undefined'){
						req_array.forEach(req => {
							var name = req['name']+'.json';
							// if(!filenames.includes(name)){
							// 	console.log('new data: '+req['name']);
							// 	new_data.push(req['name']);
							// }
							try {
							  var this_statSync = fs.statSync(dataFolder + name);
							  cache_mtime['en'][name] = this_statSync.mtime;
							}
							catch(err) {
							    cache_mtime['en'][name] = 0;
							}
						});
						filenames.forEach(name=>{
							cache_filenames['en'].push(name);
						});
						call_request_json(lang);
						console.log("cache_mtime['en'] = ");
						console.log(cache_mtime['en']);
					}
				});
			}
		}
	});

	var now = new Date().getTime();
	var now_ny = get_time();
	var char_num = 48;
	var delay_ms = 3000;
	var screen_interval = 5600; // 50 ms * 52 + 3000 ms
	update_msgs_opening(now_ny);
	var msgs_opening = msgs_sections['opening'][0] + msgs_sections['opening'][1];
	paste_msgs(req_array);
	// if(lang == 'en')
	// {
	// 	var temp_length = msgs.length;
	// 	while(temp_length % char_num != 0){
	// 		msgs += ' ';
	// 		temp_length = msgs.length;
	// 	}
	// 	var msgs_length = msgs.length;
	// 	var full_loop_ms = parseInt(msgs_length / char_num) * screen_interval ;
	// 	var position = now % full_loop_ms;
	// 	position = parseInt ( position / screen_interval ) * char_num;
	// 	var sliced_msg = msgs.substr(position, char_num);

	// 	res.json({ now: now, msgs: msgs, msgs_length: msgs_length, position: position, delay_ms: delay_ms, screen_interval: screen_interval, full_loop_ms: full_loop_ms, msgs_beginning: msgs_beginning, msgs_opening: msgs_opening, sliced_msg: sliced_msg });
	// }
	// else
	// {
	// 	translate_msgs(msgs, lang).then(translated => {
	//         // calc msgs length, pad, sync
	// 	    var temp_length = msgs.length;
	// 	    while(temp_length % char_num != 0){
	// 		    msgs += ' ';
	// 		    temp_length = msgs.length;
	// 	    }
	// 	    var msgs_length = msgs.length;
	// 	    var full_loop_ms = parseInt(msgs_length / char_num) * screen_interval ;
	// 	    var position = now % full_loop_ms;
	// 	    position = parseInt ( position / screen_interval ) * char_num;
	// 	    var sliced_msg = msgs.substr(position, char_num);
	    
	//         // send response
	// 	    res.json({ now: now, msgs: msgs, msgs_length: msgs_length, position: position, delay_ms: delay_ms, screen_interval: screen_interval, full_loop_ms: full_loop_ms, msgs_beginning: msgs_beginning, msgs_opening: msgs_opening, sliced_msg: sliced_msg });
	//     }).catch(err => {
	//         console.error(err);
	//         res.send(err);
	//     });
	// }
	var temp_length = msgs.length;
	while(temp_length % char_num != 0){
		msgs += ' ';
		temp_length = msgs.length;
	}
	var msgs_length = msgs.length;
	var full_loop_ms = parseInt(msgs_length / char_num) * screen_interval ;
	var position = now % full_loop_ms;
	position = parseInt ( position / screen_interval ) * char_num;
	var sliced_msg = msgs.substr(position, char_num);

	res.json({ now: now, msgs: msgs, msgs_length: msgs_length, position: position, delay_ms: delay_ms, screen_interval: screen_interval, full_loop_ms: full_loop_ms, msgs_beginning: msgs_beginning, msgs_opening: msgs_opening, sliced_msg: sliced_msg });

    
});
