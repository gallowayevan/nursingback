const compression = require('compression')
const express = require('express')
const cors = require('cors');
const mysql = require('mysql');

const app = express()
app.use(cors())
app.use(compression())
app.set('port', 8080);
console.log(process.env)
const connection = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    port: process.env.MYSQL_PORT,
    database: process.env.MYSQL_DATABASE
});



connection.connect(function (err) {
    if (err) {
        console.error('error connecting: ' + err.stack);
        return;
    }

    console.log('connected as id ' + connection.threadId);
});

app.listen(app.get('port'), () => console.log(`App listening on port ${app.get('port')} !`))