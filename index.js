var express = require("express");
var cors = require('cors');
var app = express();

app.use(cors());

// var msgs = 'Water in the camera is a sign of what can happen when wet words enter a hot field. Subjects without cameras in a place without cameras. Some people will say that this camera is a precision instrument but I say that this camera is an instrument for going stray. A camera that is straying on an object other than a human face may be detected as a human face.';
var msgs = 'Clarice Middleton shook with fear as she stood on the sidewalk outside a Wells Fargo branch in Atlanta one December morning in 2018. Moments earlier, she had tried to cash a $200 check, only to be accused of fraud by three branch employees, who then called 911. For many black Americans, going to the bank can be a fraught experience. Something as simple as trying to cash a check or open a bank account can lead to suspicious employees summoning the police, causing anxiety and fear — and sometimes even physical danger — for the accused customers. There is no data on how frequently the police are called on customers who are making legitimate everyday transactions. The phenomenon has its own social media hashtag: #BankingWhileBlack.';

app.listen(3000, () => {
 console.log("Server running on port 3000");
});

app.get("/now", (req, res, next) => {
	var now = new Date().getTime() / 1000;    // seconds since 1970 unix time
	var position = Math.round(now % msgs.length);

	res.json({ now: now, msgs: msgs, position: position, delay_ms: 1000 });
});
