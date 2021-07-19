process.env.TZ = 'America/New_York';
require('dotenv').config({ path:__dirname + '/.env'});
// console.log(__dirname);
var express = require("express");
var cors = require('cors');
var fs = require('fs');
const url = require('url');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

var app = express();
app.use(cors());

var supported_lang = ['en', 'zh', 'es', 'ko', 'ar'];

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
var msgs = {};
var title = 'NEW YORK CONSOLIDATED';
supported_lang.forEach(function(el){
	cache_filenames[el] = [];
	cache_mtime[el] = {};
	handled_response[el] = {};
});

var char_num = 48;
var delay_ms = 3000;
var screen_interval = 5600; // 50 ms * 52 + 3000 ms
var response_timer = null;


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
const {Translate} = require('@google-cloud/translate').v2;
var translate = new Translate();
function get_time(d = false, lang = 'en'){
	if(!d)
    	var d = new Date();
    var date = d.today().toUpperCase();
	var time = d.now().toUpperCase();
    // if(lang != 'en'){
    // 	translate = new Translate();
    // 	let [translations] = translate.translate(date + '[]'+time, lang);
	   //  translations = Array.isArray(translations) ? translations : [translations];
	   //  translations.forEach((translation, i) => {
	   //  	var temp_arr = translation.split("[]");
	   //  	date = temp_arr[0];
	   //  	time = temp_arr[1];
	   //  	return [date, time];
	   //  });
    // }
    // else
		return [date, time];
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
	,
	{	
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
	msgs_opening = '',
	msgs_ending = ' 0 1 2 3 4 5 6 7 8 9 Have a nice day.',
	msgs_break = '///';
function update_msgs_opening(now_ny = []){
	// console.log(title);
	if(now_ny.length == 0)
		var now_ny = get_time();
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
	
	var output = '';
	output += title;
	output += '                        ';
	output += now_temp_1 + now_temp_2;
	output += '––––––––––––––––––––––––';
	output += '————————————————————————';
	return output;
	
}
msgs_opening = update_msgs_opening();

var ready_now = 0;
var ready_full = req_array.length;

function format_msgs(name, response, results_count = false, lang){
	/*
		formats the live json response.
		returns the formatted message or '' if there's an error, which is usually due to the change of source json format.
	*/

	if(results_count == '')
		results_count = 1;
	var response = response;
	var this_msgs = '';
	
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
		var index = 0;
		var data_count = 0;
		while(data_count < 1){			
			if(response[index]['type'] == 'Free'){
				this_msgs += ' Free public hotspot "'+response[index]['ssid']+'" at '+response[index]['location'];
				data_count++;
			}
			index++;
		}
	}
	else if(name == 'street-tree'){
		var index = 0;
		var data_count = 0;
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
		}
		else
		{
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
		
	}
	else if(name == 'energy-efficiency-projects'){
		var index = 0;
		var data_count = 0;
		this_msgs += " The City's Energy Efficiency Projects: ";
		while(data_count < results_count){
			if(response[index]['projectsitename'] && response[index]['primaryprojecttype']!='Other'){
				this_msgs += response[index]['primaryprojecttype'] + ' for '+ response[index]['projectsitename']+'. Status: '+response[index]['projectstatus']+' '+msgs_break;
				data_count++;
			}
			index++;			
		}
	}
	else if(name == 'DCA-license'){
		var index = 0;
		var data_count = 0;
		this_msgs += " From DCA : Legally Operating Businesses License issued to";
		
		while(data_count < results_count){
			if(response[index]['status']=='Issued'){
				this_msgs += response[index]['business_name']+' '+msgs_break;
				data_count++;
			}
			index++;		
		}
	}
	else if(name == 'weather')
	{
		if(response['properties'] != undefined)
		{
			this_msgs += " Today's weather in NYC: ";
			var weather_data_now = response['properties']['periods'][0]['detailedForecast'];
			this_msgs += weather_data_now;
			this_msgs += msgs_break;
		}
		else{
			console.log('handle_msg(weather): response["properties"] == undefined');
			// return false;
		}
	}
	
	return this_msgs;
}

function paste_msgs(res, req_array, lang = 'en'){
	console.log('paste_msgs');
	var msgs_temp = msgs_opening;
	for(i = 0; i < req_array.length; i++){
		var this_key = req_array[i]['name'];
		msgs_temp += handled_response[lang][this_key];
	}
	msgs_temp += msgs_ending;
	msgs = msgs_temp.toUpperCase();
	send_msgs(res, msgs, lang);
}

// -------------  end msgs.js ---------------------

// -------------  json.js     ---------------------
Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

function request_json(name, request_url, data_type, results_count = false, use_header = true, cache_lifecycle = false, lang, res) {
    // console.log('=====  '+name+'  =====');

    var hasCache = cache_filenames[lang].includes(name+'.txt') !== false; // whether it has cache of the specified language
    var hasEnCache = cache_filenames['en'].includes(name+'.txt') !== false; // whether it has cache of english
    var this_en_mtime = cache_mtime['en'][name+'.txt']; // m time of the enslish json
    var this_mtime = cache_mtime[lang][name+'.txt'];

    if(lang == 'en'){
    	this_en_mtime = this_mtime;
    	hasEnCache = hasCache;
    }
    var now_timestamp = new Date().getTime();
    now_timestamp = parseInt(now_timestamp/1000); // ms to s
    if(cache_lifecycle){
    	cache_lifecycle = cache_lifecycle * 60;
    }

    // using cache but no cached file -> newly added 
    if(cache_lifecycle && !hasCache)
    	isNew = true;
    else
    	isNew = false;
    // force using chinese json. Workaround for translate-temp
    if(lang == 'cccc')
    {
    	// output = request_cache(name, 'txt', results_count, lang, res);
    	request_live(name, request_url, data_type, results_count, use_header, hasCache, now_timestamp, false, lang, res);
    	
    }
    else
    {
    	// console.log('now_timestamp   = '+now_timestamp);
    	// console.log('hasEnCache? '+hasEnCache);
    	// console.log(cache_mtime['en']);
    	// console.log('this_mtime      = '+this_mtime);
    	// console.log('this_en_mtime      = '+this_en_mtime);
    	// console.log(now_timestamp - this_mtime);
    	// console.log('cache_lifecycle = '+cache_lifecycle);
    	// console.log('cache expired: '+ (now_timestamp - this_mtime > cache_lifecycle));
    	// console.log('en cache expired: '+ (now_timestamp - this_en_mtime > cache_lifecycle));
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
			request_live(name, request_url, data_type, results_count, use_header, hasCache, now_timestamp, false, lang, res);
	    }else{
	    	if( isNew || this_mtime < this_en_mtime - 100 ){
	    		console.log('request_english_cache');
	    		request_english_cache(name, 'txt', lang, res);
	    	}
	    	else{
	    		request_cache(name, 'txt', results_count, lang, res);
	    	}
	    }
    }

}

function request_live(name, request_url, data_type,results_count = false, use_header = true, hasCache, now_timestamp, cache_lifecycle = false, lang, res){
	console.log('request_live for '+name+'...');
	var counter = 0;
	var counter_max = 3;
	var timeout = 5000;
	
    var httpRequest = new XMLHttpRequest();

	httpRequest.ontimeout = function(){
		if(hasCache)
			request_cache(name, data_type, results_count, lang, res);
		else
			checkReady(name, lang, res, 'request_live timeout and no cache');
	};
	httpRequest.onreadystatechange = function(){
		
		if (httpRequest.readyState === 4) {
	      if (httpRequest.status === 200) {	
	      	if(data_type == 'json'){
      			try{	
      				var response_en = JSON.parse(httpRequest.responseText);
      				console.log('request_live for '+name+' success!');
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
      			var handled_response_en = format_msgs(name, response_en, results_count, lang); // static/js/msg.js
      			if(!handled_response_en)
      			{
      				request_cache(name, 'txt', results_count, lang, res);
      				return false;
      			}
      			if(lang == undefined || lang == '')
      			{
      				console.log('lang is undefined in request_live()');
      			}
      			if(lang == 'en')
      			{
      				handled_response[lang][name] = handled_response_en;
      				now_timestamp = new Date().getTime();
    				now_timestamp = parseInt(now_timestamp/1000); // ms to s
    				checkReady(name, lang, res);
    				update_cache(name, handled_response[lang][name], 'txt', now_timestamp, lang); // update lang cache
      			}
      			else
      			{
      				console.log('received en live data for '+lang+' '+name);
      				translate_msgs(handled_response_en, lang, name, res).catch(err => {
				        // console.error(err);
				        // res.send(err);
				        return false;
				    });

      			}
      			// ready_now++;
      		}
	      	counter++;
	      } else {
	      	if(hasCache){
	      		console.log('status !== 200, use cached file for '+name);
	      		request_cache(name, 'txt', results_count, lang, res);
	      	}else{
	      		console.log('please check the request url');
	      	}
	      }
	    }
	};
	httpRequest.open('GET', request_url);
	httpRequest.timeout = timeout;
	if(use_header)
		httpRequest.setRequestHeader('Content-Type', 'application/'+data_type);

	httpRequest.send();
}

function update_cache(cache_filename = '', handled_response, cache_data_type='txt', now_timestamp, lang){
	// console.log('updating cache: '+cache_filename +', '+lang+'...');
	var cache_path = __dirname + '/static/data/'+lang+'/'+cache_filename+'.'+cache_data_type;
	fs.writeFile(cache_path, handled_response, function(err, result) {
		if(err) console.log('error', err);
	});
	
	cache_mtime[lang][cache_filename+'.'+cache_data_type] = now_timestamp;
}
	
function request_cache(cache_filename = '', cache_data_type="txt", results_count = false, lang, res){
	var req_url = __dirname + '/static/data/'+lang+'/'+cache_filename+'.'+cache_data_type;
	// console.log('request_cache(): '+req_url);
	fs.access(req_url, fs.F_OK, (err) =>{
		if(err){
			console.log('request_cache(): cant find cached file '+cache_filename+ ' of '+lang);
			var hasCache = false;
			var now_timestamp = new Date().getTime();
			now_timestamp = parseInt(now_timestamp/1000); // ms to s
			var request_url = '';
			for(var i = 0 ; i < req_array.length ; i++){
		    	if(req_array[i]['name'] == cache_filename)
		    		request_live(req_array[i]['name'], req_array[i]['req_url'], req_array[i]['data_type'], req_array[i]['results_count'], req_array[i]['use_header'], hasCache, req_array[i]['cache_lifecycle'], lang, res);
		    }
			
			return false;
		}
		else
		{
			// console.log('request_cache(): file exists');
			var this_cache = fs.readFile(req_url, 'utf8', function(err, data){
				var this_last_updated = fs.statSync(req_url).mtime;
				this_last_updated = parseInt(new Date(this_last_updated).getTime()/1000);
				if(this_last_updated != cache_mtime[cache_filename+'.'+cache_data_type])
				    cache_mtime[cache_filename+'.'+cache_data_type] = this_last_updated;
				handled_response[lang][cache_filename] = data;
				checkReady(cache_filename, lang, res);
			});
			
		}
	});
}
function request_english_cache(cache_filename = '', cache_data_type="txt", lang, res){
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

			if(lang == undefined || lang == '')
  			{
  				console.log('lang is undefined in request_english_cache()');
  			}
  			try
  			{
  				// console.log('has en cache');
  				fs.readFile(req_url_en, 'utf8', function(err, data){
					translate_msgs(data, lang, cache_filename, res).catch(err => {
				        // console.error(err);
				        // translated.send(err);
				        return false;
				    });
				});
  			}
  			catch(err){
  				console.log('Fail to fs.readFileSync( '+ req_url_en +' )');
				console.error(err);
		        return false;
			}
			
		}
	});
}
// -------------  end json.js     -----------------

// -------------  call_request_json.js     --------

function call_request_json(lang='en', res){
	now = new Date();
	now_hr = now.hour();
	now_min = now.minute();
	var output = [];

    for(var i = 0 ; i < req_array.length ; i++){
    	if(req_array[i]['name'] == 'train')
    		req_array[i]['req_url'] = "https://mtaapi.herokuapp.com/times?hour="+now_hr+"&minute="+now_min;
    	var this_output = request_json(req_array[i]['name'], req_array[i]['req_url'], req_array[i]['data_type'], req_array[i]['results_count'], req_array[i]['use_header'], req_array[i]['cache_lifecycle'], lang, res);
    	// output.push(this_output);
    	// console.log('this_output = ');
    	// console.log(this_output);
    }
    // console.log('call_request_json() output = ');
    // console.log(output);
}
// -------------  end call_request_json.js  ----



// translate


async function translate_msgs(text, target, name, res) {
	// console.log('translating '+name+ ' into ' +target+'...');
    let [translations] = await translate.translate(text, target);
    translations = Array.isArray(translations) ? translations : [translations];
    translations.forEach((translation, i) => {
    	// console.log(translation);
    	var now_timestamp = new Date().getTime();
		now_timestamp = parseInt(now_timestamp/1000); // ms to s
		update_cache(name, translation, 'txt', now_timestamp, target); // update lang cache
		update_cache(name, text, 'txt', now_timestamp, 'en'); // update en cache
    	handled_response[target][name] = translation;
    	checkReady(name, target, res);
    });
}

async function translate_title(text, target) {
	console.log('translating title...');
    let [translations] = await translate.translate(text, target);
    translations = Array.isArray(translations) ? translations : [translations];
    translations.forEach((translation, i) => {
    	console.log('translated title = '+translation);
    	title = translation;
    	while(title.length < 24)
    		title += ' ';
    	var now_timestamp = new Date().getTime();
		now_timestamp = parseInt(now_timestamp/1000); // ms to s
		update_cache('_title', translation, 'txt', now_timestamp, target); // update lang cache
    });
}
async function get_translated_time(res, req_array, target) {
	console.log('translating time...');
	var get_time_temp = get_time();
	var date = get_time_temp[0];
	var time = get_time_temp[1];
    let [translations] = await translate.translate(date+'[]'+time, target);
    translations = Array.isArray(translations) ? translations : [translations];
    translations.forEach((translation, i) => {
    	var time_arr = translation.split("[]");
  		msgs_opening = update_msgs_opening(time_arr);
		paste_msgs(res, req_array, target);
    });
}

function checkReady(name, lang, res, failed = false){
	ready_now++;

	// console.log('ready now: ' + ready_now + ' / ' + ready_full);
	if(failed)
		console.log('failed: ' + name + ' / ' + lang + "\n" + failed);
	if(ready_now >= ready_full)
	{
		if(response_timer != null)
		{
			clearTimeout(response_timer);
			response_timer = null;
		}
		if(lang == 'en'){
			msgs_opening = update_msgs_opening();
			paste_msgs(res, req_array, lang);
		}
		else
		{
			get_translated_time(res, req_array, lang);
		}
	}
	else
	{
		clearTimeout(response_timer);
		response_timer = null;
		response_timer = setTimeout(function(){
			paste_msgs(res, req_array, lang);
		}, 3500);
	}
}
// sending response...

function send_msgs(res, msgs, lang){
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
	console.log('All set. sending response...');
	try{
		setTimeout(function(){
			res.json(
				{ 
					// now: now, 
					msgs: msgs, 
					msgs_length: msgs_length, 
					position: position, 
					delay_ms: delay_ms, 
					screen_interval: screen_interval, 
					full_loop_ms: full_loop_ms, 
					msgs_opening: msgs_opening, 
					sliced_msg: sliced_msg
				}
			);
		}, 0);
	}
	catch(err)
	{
		// Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client
		console.log(err);
	}
	
}

app.listen(3000, () => {
	console.log("Server running on port 3000");
});

app.get("/now", (req, res, next) => {
	ready_now = 0;
	var dataFolder = __dirname + '/static/data/';
	const queryObject = url.parse(req.url,true).query;
	var lang = 'en';
  	if(queryObject['lang'] != undefined)
  	{
  		lang = queryObject['lang'];
  		if(!supported_lang.includes(lang))
  			lang = 'en';
  	}

  	var dataFolder_en = dataFolder + 'en' + '/';
  	dataFolder = dataFolder + lang + '/';
  	
  	fs.readdir(dataFolder, (err, filenames) => {
		if(typeof filenames != 'undefined'){
			req_array.forEach(req => {
				var name = req['name']+'.txt';
				try {
					var this_statSync = fs.statSync(dataFolder + name);
					cache_mtime[lang][name] = parseInt(Date.parse(this_statSync.mtime)/1000);
				}
				catch(err) {
				    cache_mtime[lang][name] = 0;
				}
			});
			filenames.forEach(name=>{
				cache_filenames[lang].push(name);
			});
			if(lang == 'en'){
				console.log(title);
				title = title + '   ';
				call_request_json(lang, res);
			}
			else
			{
				// console.log('0. receiving request of'+lang);
				console.log('lang = '+lang);
				fs.access(__dirname + '/static/data/'+lang+'/_title.txt', fs.F_OK, (err) =>{
					if(err){
						console.log(err);
						console.log('no title file');
						translate_title(title, lang);
					}
					else
					{
						fs.readFile(__dirname + '/static/data/'+lang+'/_title.txt', 'utf8', function(err, data){
							title = data;
							console.log(title);
							while(title.length < 24)
    							title += ' ';
						});
					}
				});
				fs.readdir(dataFolder_en, (err, filenames) => {
					if(typeof filenames != 'undefined'){
						req_array.forEach(req => {
							var name = req['name']+'.txt';
							try {
							  var this_statSync = fs.statSync(dataFolder_en + name);
							  cache_mtime['en'][name] = parseInt(Date.parse(this_statSync.mtime)/1000);
							}
							catch(err) {
							    cache_mtime['en'][name] = 0;
							}
						});
						filenames.forEach(name=>{
							cache_filenames['en'].push(name);
						});
						call_request_json(lang, res);
					}
				});
			}
		}
	});

	// console.log('after fs');

    
});
