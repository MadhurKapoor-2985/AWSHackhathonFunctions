'use-strict'
const sql = require('mssql')

exports.handler = async (event) => {

    let customerId
    if(event.Records === undefined) {
        customerId = event.customerId
    }

    console.log("Customer id is ", customerId)

     const config = {
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
        options: {
            encrypt: true // Use this if you're on Windows Azure
        }
    }

    try {
        // Open DB Connection
        let pool = await sql.connect(config)

        result = await pool.request()
            .input('lookupValue', sql.NVarChar, customerId)
            .query('select * from TempUserInfo where CustomerId = @lookupValue')

        if(result.recordset[0] === undefined) {
            pool.close()
            return {
                statusCode: 40,
                body: "Not Found"
            }
        }

        TempInfo = JSON.parse(JSON.stringify(result.recordset[0]))
    }
    catch(err)
    {
        //pool.close()
        console.log("An error occured", err)
        return {
            statusCode: 500,
            body: "An error occured"
        }
    }

    const output = {
        CustomerTempInfo: TempInfo
    }
    
    return {
    statusCode: 200,
    body: output
}

};