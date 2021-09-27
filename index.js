const compression = require('compression')
const express = require('express')
const cors = require('cors');
const mysql = require('mysql');
const { query } = require('express');
const { groups } = require('d3-array');

const app = express()
app.use(cors())
app.use(compression())
app.set('port', 8080);

let connectionSettings = {
    connectionLimit: 10,
    host: "localhost",
    user: "nodeapp",
    password: "password",
    port: 3306,
    database: "nursingmodel"
}

if (process.env.NODE_ENV == "production") {
    connectionSettings = {
        connectionLimit: 10,
        host: process.env.NURSING_MODEL_DB_SERVICE_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        port: process.env.NURSING_MODEL_DB_SERVICE_PORT,
        database: process.env.MYSQL_DATABASE
    }
}

let db;
try {
    db = mysql.createPool(connectionSettings);
    console.log("Connected to DB")
}
catch (err) {
    console.log(err);
}

const minYear = 2019;
let dataID = 0;
app.get('/data', function (req, res) {
    const { calculation, setting } = req.query;

    if (calculation == "supply" || calculation == "demand") {
        const queryArray = prepareQueryArray(calculation, req.query);
        //Conditional added to compensate for there being only one demand scenario.
        const allSettings = +setting === -9;

        const scenario = calculation == "demand" ? 1 : +queryArray.find(d => d[0].includes("Scenario"))[1];
        const queryArrayRenamed = queryArray.filter(function (d) {
            if (allSettings & d[0] === "setting") return false;
            return true;
        }).filter(d => d[0].indexOf("Scenario") < 0)
            .map(d => [calculation + scenario + "." + d[0], d[1]])

        db.query(constructQuery(calculation + scenario, queryArrayRenamed, allSettings), queryArrayRenamed.map(d => d[1]), (error, results, fields) => {
            if (error) {
                return console.error(error.message);
            }
            const rows = allSettings ? groups(results, d => d.setting).map(function (row) {
                const values = row[1];
                const id = dataID++;
                const params = [["calculation", calculation], ["setting", row[0]], ...queryArray.filter(d => d[0] !== "setting")];
                return { values, id, params }
            }) : [{ values: results, id: dataID++, params: [["calculation", calculation], ...queryArray] }]
            res.json(rows);
        });
    } else if (calculation == "percentage" || calculation == "difference") {


        const queryArray = Object.entries(req.query)
            .map(d => [d[0], +d[1]])
            .filter(d => d[0] != "calculation");

        const allSettings = +setting === -9;

        const scenario = new Map(queryArray.filter(d => d[0].includes("Scenario")).map(d => [d[0].slice(0, 6), d[1]]));
        scenario.set("demand", 1); //Added to compensate for there being only one demand scenario.
        const queryArrayRenamed = queryArray.filter(function (d) {
            if (allSettings & d[0] === "setting") return false;
            return true;
        }).filter(d => d[0].indexOf("Scenario") < 0)
            .map(d => [`supply${scenario.get("supply")}.` + d[0], d[1]]).filter(function (d) {
                if (allSettings & d[0] === "setting") return false;
                return true;
            });

        const where = queryArrayRenamed.length ?
            "WHERE " + queryArrayRenamed.map(d => `${d[0]} = ?`).join(" AND ") + ` AND supply${scenario.get("supply")}.year >= ${minYear}` :
            `WHERE supply${scenario.get("supply")}.year >= ${minYear}`;

        const sql = `SELECT
                supply${scenario.get("supply")}.year,
                supply${scenario.get("supply")}.location,
                supply${scenario.get("supply")}.setting,
                supply${scenario.get("supply")}.mean supplyMean,
                demand${scenario.get("demand")}.mean demandMean,
                ROUND((supply${scenario.get("supply")}.mean - demand${scenario.get("demand")}.mean)/supply${scenario.get("supply")}.mean, 3) ${calculation === "percentage" ? `value` : `percentage`},
                ROUND(supply${scenario.get("supply")}.mean - demand${scenario.get("demand")}.mean, 3) ${calculation === "difference" ? `value` : `difference`}
            FROM
                supply${scenario.get("supply")}
                INNER JOIN demand${scenario.get("demand")} ON supply${scenario.get("supply")}.id = demand${scenario.get("demand")}.id
            ${where}
            ${allSettings ? ` AND supply${scenario.get("supply")}.setting <> 0` : ""}
            ORDER BY
                supply${scenario.get("supply")}.year`;

        db.query(sql, queryArrayRenamed.map(d => d[1]), (error, results, fields) => {
            if (error) {
                return console.error(error.message);
            }
            const rows = allSettings ? groups(results, d => d.setting).map(function (row) {
                const values = row[1];
                const id = dataID++;
                const params = [["calculation", calculation], ["setting", row[0]], ...queryArray.filter(d => d[0] !== "setting")];
                return { values, id, params }
            }) : [{ values: results, id: dataID++, params: [["calculation", calculation], ...queryArray] }]

            res.json(rows);
        });

    }
}
)



function prepareQueryArray(table, queryObject) {

    const queryArray = Object.entries(queryObject)
        .map(d => [d[0], +d[1]])
        .filter(d => d[0] != "calculation"); //Get rid of calculation because this related to tables not columns

    return queryArray;

}

function renameScenario(scenarioValue, queryArray) {
    return queryArray.map(d => d[0].indexOf("Scenario") > -1 ? ["scenario", scenarioValue] : d);
}

function constructQuery(table, queryArray, allSettings) {


    const select = `SELECT year, location, setting, mean value ${table.includes("supply") ? ", lci, uci" : ""}`;
    let where = queryArray.length ?
        "WHERE " + queryArray.map(d => `${d[0]} = ?`).join(" AND ") + ` AND year >= ${minYear}` :
        `WHERE year >= ${minYear}`;
    where += allSettings ? `AND setting <> 0` : "";
    const orderBy = `ORDER BY year`;
    return `${select} FROM ${table} ${where} ${orderBy};`;
}





app.get('/data/', function (req, res) {
    connection.query(q, function (error, results, fields) {
        if (error) throw error;
        res.json(results);
    });
});


app.listen(app.get('port'), () => console.log(`App listening on port ${app.get('port')} !`))