'use-strict'
var AWS = require('aws-sdk');
const axios = require('axios');
var Amadeus = require('amadeus');

exports.handler = async (event) => {

    if(event.Records === undefined) {
        customerId = event.customerId
    }
    else {
        customerId = JSON.parse(event.Records[0].body).customerId
    }

    tempUrl = process.env.TEMP_URL
    let source, destination, rewardPoints, Email
    finalUrl = tempUrl + '?customerId=' + customerId
    console.log('finalUrl is ', finalUrl)
    await axios.get(finalUrl)
    .then(data => {

        parsedData = JSON.parse(JSON.stringify(data.data))
        console.log('parsed data, ',parsedData)

        source = parsedData.body.CustomerTempInfo.DeviceLocation.trim()
        destination = parsedData.body.CustomerTempInfo.CustomerBaseLocation.trim()
        rewardPoints = parsedData.body.CustomerTempInfo.NewRewardPoints
        Email = parsedData.body.CustomerTempInfo.CustomerEmail

    })
    .catch(error => {
        console.log(error)
       
        return {
            statusCode: 400,
            body: "Some Error occured"
        }
    })

    var travelDate = new Date();
    var numberOfDaysToAdd = 2;
    travelDate.setDate(travelDate.getDate() + numberOfDaysToAdd);

    var dd = travelDate.getDate();
    var mm = travelDate.getMonth() + 1;
    var y = travelDate.getFullYear();

    mm = '0' + mm;

    var someFormattedDate = y + '-'+ mm + '-'+ dd;
    console.log('Date is', someFormattedDate)

    console.log (source + ' ' + destination + ' ' + rewardPoints)
    client_ID = process.env.API_KEY
    client_Secret = process.env.APP_SECRET

    var amadeus = new Amadeus({
        clientId: client_ID,
        clientSecret: client_Secret
      });

      let price, currency, airline, airlineno, departure, arrival
      
      await amadeus.shopping.flightOffersSearch.get({
          originLocationCode: 'ORD',
          destinationLocationCode: 'YYZ',
          departureDate: someFormattedDate,
          adults: '1',
          max: '1'
      }).then(function(response){
        return amadeus.shopping.flightOffers.pricing.post(
          JSON.stringify({
            'data': {
              'type': 'flight-offers-pricing',
              'flightOffers': response.data
            }
          })
        )
    }).then(function(response){
        console.log('Pricing data')
        console.log(response.data.flightOffers[0].itineraries[0].segments);
        console.log(response.data.flightOffers[0].price);

        price = response.data.flightOffers[0].price.total
        currency = response.data.flightOffers[0].price.currency
        airline = response.data.flightOffers[0].itineraries[0].segments[0].carrierCode
        airlineno = response.data.flightOffers[0].itineraries[0].segments[0].number
        departure = response.data.flightOffers[0].itineraries[0].segments[0].departure
        arrival = response.data.flightOffers[0].itineraries[0].segments[0].arrival


    }).catch(function(responseError){
        console.log(responseError);
        return {
            statusCode: 400,
            body: "Error",
        };
    });

    const payLoad = {
        CustomerEmail: Email,
        CustomerGuid: '',
        MessageType: '4',
        Price: price,
        Currency: currency,
        Airline: airline,
        AirlineNo: airlineno,
        Departure: departure,
        Arrival: arrival

    }

    AWS.config.update({region: 'us-west-2'});
    
    var params = {
    Message: JSON.stringify(payLoad), /* required */
    TopicArn: process.env.SNS_ARN
    };

    // Create promise and SNS service object
    var publishTextPromise = await new AWS.SNS({apiVersion: '2010-03-31'}).publish(params).promise();  

    const response = {
        statusCode: 200,
        body: "Successfully Processed",
    };
    return response;
    

};