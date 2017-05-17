'use strict';

var aws  = require('aws-sdk');
var r53 = new aws.Route53();
var sns = new aws.SNS();
var http = require ('http');

exports.handler = (event, context, callback) => {
    var ROUTE53_HOSTED_ZONE = event.hostedid;
    var topicARN = event.topicarn;
    
    getR53HostedZone(ROUTE53_HOSTED_ZONE, topicARN);
        function getR53HostedZone(hostedid, topicARN){
          r53.listResourceRecordSets({HostedZoneId: hostedid},
            function(err, data) {
              if (err) {
                console.log(err, err.stack);
              } else {
                //console.log(data);
                data.ResourceRecordSets.forEach(function(record){
                    if(record.AliasTarget != null){
                        console.log(record);
                        let body = '';
                        const req = http.get("http://" + record.Name.replace(/.$/, "") + "/", (res) => {
                            console.log('Status:', res.statusCode);
                            console.log('Headers:', JSON.stringify(res.headers));
                            res.setEncoding('utf8');
                            res.on('data', (chunk) => body += chunk);
                            res.on('end', () => {
                                console.log('Successfully processed HTTP response');
                                // If we know it's JSON, parse it
                                if (res.headers['content-type'] === 'application/json') {
                                    body = JSON.parse(body);
                                }
                                console.log(body);
                                if(body.match(/The specified bucket does not exist/)){
                                    console.log("Bucket Not Exist!");
                                    snsPublish(record.Name.replace(/.$/, ""), topicARN);
                                }
                            });
                        });
                    }
                });
              }
            }
          )
        }
        
        function snsPublish(recordName, topicARN){
            console.log("Sending message for SNS...");
            sns.publish({
               Message: "You have record in Route53 but S3 bucket is not existing.\nPlease see https://console.aws.amazon.com/route53/home",
               Subject: recordName + " is missing. Please check it.",
               TopicArn: topicARN
                }, function(err, data){
                    if ( err ) context.fail('fail');
                });  
        }
};
