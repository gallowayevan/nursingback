const compression = require('compression')
const express = require('express')
const cors = require('cors');
const mysql = require('mysql');

const app = express()
app.use(cors())
app.use(compression())
app.set('port', 8080);

const connection = mysql.createConnection({
    host: process.env.MYSQL_SERVICE_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    port: process.env.MYSQL_SERVICE_PORT,
    database: process.env.MYSQL_DATABASE
});

const q = `SELECT
supply32.year,
supply32.location,
supply32.setting,
supply32.mean supplyMean,
demand1.mean demandMean,
ROUND(supply32.mean - demand1.mean, 3) value
FROM
supply32
INNER JOIN demand1 ON supply32.id = demand1.id
WHERE
supply32.type = 2
AND supply32.education = 0
AND supply32.rateOrTotal = 1
AND supply32.fteOrHeadcount = 0
AND supply32.locationType = 8
AND supply32.location = 801
AND supply32.setting = 0
ORDER BY
supply32.year;`



app.get('/data/', function (req, res) {
    connection.query(q, function (error, results, fields) {
        if (error) throw error;
        res.json(results);
    });
});

app.listen(app.get('port'), () => console.log(`App listening on port ${app.get('port')} !`))