var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var socketIo = require("socket.io");

var routes = require('./routes/index');
var users = require('./routes/users');
var game = require('./model/game');
var test = require('./routes/test');
var databaseUrl = "mongodb://localhost:27017/blackjack";
var app = express();
var server = http.createServer(app);
io = socketIo(server);
server.listen(3000);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

app.use('/test',test);
// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;


//Other resource
// Card image from http://www.jfitz.com/cards/classic-playing-cards.png



//Socket IO programming
var tables=[];
var sockets={};
var playerSocket={};
function getPlayer(players,plId){

    var temp = players.filter(function(items){
        return items.playerId==plId;
    });
    return temp[0];
}
function getOtherPlayer(players,plId){

    var temp = players.filter(function(items){
        return items.playerId != plId;
    });

    return temp;
}



function getLiveTable(playerId,tableIndex){

    var temp = {};

    var tbl = tables[tableIndex];
    //  console.log(tbl.players);
    temp.tableName=tbl.tableName;
    temp.player = getPlayer(tbl.players,playerId);
    temp.otherPlayer = getOtherPlayer(tbl.players,playerId);

    temp.dealer = tbl.dealer;

    return temp;

}

function findPlayersFromTable(tableName){
    //Return allPlayers from table
    var table = tables.filter(function(items){
        return items.tableName==tableName; 
    });

    return table.players;
}
function findPlayer(playerId){
    //return player
    for(var i =0; i<tables.length ;i++){
        var elementPos = tables[i].players.map(function(x) {return x.playerId; }).indexOf(playerId);
        if(elementPos>=0){
            return tables[i].players[elementPos];
        }
    }
}
//http://stackoverflow.com/questions/9710315/how-can-i-get-a-key-name-in-a-hash-by-using-its-value
function getKeysForValue(obj, value) {
    var all = [];
    for (var name in obj) {
        if (Object.hasOwnProperty(name) && obj[name] === value) {
            all.push(name);
        }
    }
    return all;
}



var table = {

    tableName: "",
    players:[],
    numberOfPlayer: 0,
    dealer : null,
    stack: [],
    stackIndex:0


};
var liveTable={
    tableName:"afsf",
    otherPlayer:[],
    player:{ cards:[], status:"", total:3},
    dealer:{openCards:[],blindedCard:"",total:10}
};

function sendUpdateToAllPlayer(tableIndex){
    // console.log(table);
    var players = tables[tableIndex].players;
    var liveTbl;
    for(var i =0 ;i < players.length ; i++){
        liveTbl = getLiveTable(players[i].playerId,tableIndex);
        sockets[players[i].playerId].emit("update",liveTbl);

    }
}
function findTableIndex(tableName){
    var elementPos = tables.map(function(x) {return x.tableName; }).indexOf(tableName);
    return elementPos;
}

function getPlayerFromTable(table,playerId){
    var player = table.players.filter(function(items){
        return items.playerId=playerId;
    });
};

function findPlayerTable(playerId){
    var player;
    for(var i =0 ; i < tables.length ; i++){
        player = tables[i].players.filter(function(player){
            return player.playerId==playerId;
        });
        if(player.length>0){
            return i;
        }
    }
    return null;


}

function removeEmptyTable(){
    for(var i =0; i<tables.length;i++){

        if(tables[i].numberOfPlayer===0){
            tables.splice(i,1);
            console.log("Empty table removed");
        }
    }
}

function getCardJSON(x){
    var char = x.charAt(x.length-1);
    var value1;
    var value2;
    if(char==="A"){
        value1=1;
        value2=11;
    }
    else if(char==="J" || char === "Q" || char === "K"){
        value1=10;
        value2=10;
    }
    else if(char === "0"){
        value1=10;
        value2=10;
    }
    else{
        value1=parseInt(char);
        value2=parseInt(char);
    }
    return {card:x,value1:value1,value2:value2};
}

function removePlayerFromTable(playerId){
    var tableIndex =findPlayerTable(playerId);

    if(tableIndex!=null){
        var elementPos = tables[tableIndex].players.map(function(x) {return x.playerId; }).indexOf(playerId);

        tables[tableIndex].players.splice(elementPos,1);
        tables[tableIndex].numberOfPlayer = tables[tableIndex].numberOfPlayer-1;

    }
};
function updateTotal(table){
    for(var i=0; i<table.players.length;i++){
        var total1=0;
        var total2=0;
        for(var j= 0;j<table.players[i].cards.length;j++){
            total1 = total1 + table.players[i].cards[j].value1;
            total2 = total2 + table.players[i].cards[j].value2;
        }
        table.players[i].total1= total1;
        table.players[i].total2 = total2;

    }
    var dealerTotal1=0;
    var dealerTotal2=0;
    for(var k =0; k<table.dealer.openCards.length;k++){
        dealerTotal1=dealerTotal2+table.dealer.openCards[k].value1;
        dealerTotal2=dealerTotal2+table.dealer.openCards[k].value2;
    }
    table.dealer.total1=dealerTotal1;
    table.dealer.total2=dealerTotal2;
}

function checkPlayerTotal(table){
    for(var i=0;i<table.players.length;i++){
        var total;
        if(table.players[i].total1>=table.players[i].total2){
            //total1 > total2
            if(table.players[i].total1>21){
                //total1 > 21
                if(table.players[i].total2!=0){
                    //total2 ! = null  
                    total=table.players[i].total2;
                }else{
                    // total2 === null
                    total = table.players[i].total1;
                }
            }else{
                // total 1 > total 2 and <21
                total = table.players[i].total1;
            }

        }else{
            // total2 > total1
            if(table.players[i].total2>21){
                // total 2 > 21 
                total = table.players[i].total1;
            }else{
                total = table.players[i].total2;
            }
        }
        if(total>21){
            table.players[i].status = "lose"
        }
    }
}
function checkDealerTotal(table){
    var total=0;
    if(table.dealer.total1>=table.dealer.total2){
        //total1 > total2
        if(table.dealer.total1>21){
            //total1 > 21
            if(table.dealer.total2!=0){
                //total2 ! = null  
                total=table.dealer.total2;
            }else{
                // total2 === null
                total = table.dealer.total1;
            }
        }else{
            // total 1 > total 2 and <21
            total = table.dealer.total1;
        }

    }else{
        // total2 > total1
        if(table.dealer.total2>21){
            // total 2 > 21 
            total = table.dealer.total1;
        }else{
            total = table.dealer.total2;
        }
    }
    return total;
}
function checkFinalTotal(table){
    checkPlayerTotal(table);
    var dTotal = checkDealerTotal(table);
    console.log(dTotal);
    if(dTotal > 21){
        for(var i =0; i <table.players.length;i++){
           console.log( table.players[i].status);
            if(table.players[i].status==="stand") {
                table.players[i].status="win";
            }
        }
    }else{
        for(var i=0;i<table.players.length;i++){
            var total;
            if(table.players[i].total1>=table.players[i].total2){
                //total1 > total2
                if(table.players[i].total1>21){
                    //total1 > 21
                    if(table.players[i].total2!=0){
                        //total2 ! = null  
                        total=table.players[i].total2;
                    }else{
                        // total2 === null
                        total = table.players[i].total1;
                    }
                }else{
                    // total 1 > total 2 and <21
                    total = table.players[i].total1;
                }

            }else{
                // total2 > total1
                if(table.players[i].total2>21){
                    // total 2 > 21 
                    total = table.players[i].total1;
                }else{
                    total = table.players[i].total2;
                }
            }
            if(total<dTotal){
                table.players[i].statue = "lose";
            }
        }
    }
}
function deal(player,table){
    player.status="deal";
    player.cards.push(getCardJSON(table.stack.cards[table.stackIndex]));
    table.stackIndex=table.stackIndex+1;
    var temp=1;


    //check if all players has atlease 1 card
    for(var i =0 ; i<table.players.length;i++){

        if(table.players[i].cards.length<1){

            temp=0; 
            break;
        }
    }

    //All player has atlease one card
    if(temp===1){

        //if dealer has no card give dealer a first card

        if(table.dealer.openCards.length<1){

            table.dealer.openCards.push(getCardJSON(table.stack.cards[table.stackIndex]));
            table.stackIndex=table.stackIndex+1;

            //give all player a second card

            for(var j=0;j<table.players.length;j++){
                table.players[j].cards.push(getCardJSON(table.stack.cards[table.stackIndex]));
                table.stackIndex=table.stackIndex+1;
            }
            //give dealer a second card

            table.dealer.blindedCard.push(getCardJSON(table.stack.cards[table.stackIndex]));
            table.stackIndex=table.stackIndex+1;



        }

    }
    //Some player yet has no card
    else{
        //wait for all player to select deal

    }
    updateTotal(table);
}

function hit(player,table){

    player.status="hit";

    player.cards.push(getCardJSON(table.stack.cards[table.stackIndex]));
    table.stackIndex=table.stackIndex+1;

    updateTotal(table);

    var dTotal =  checkFinalTotal(table);

}

function stand(player,table){

    player.status="stand";
    var tableIndex = findPlayerTable(player.playerId);
    temp=1;
    for(var i =0 ;i < table.players.length;i++){
        if(table.players[i].status==="hit"){
            temp=0;
            break;
        }
    }

    if(temp===0){
        //One player has hit.
        //Wait for other players to select stand
    }else{
        //All players have selected stand
        //Open dealers card.

        if(table.dealer.blindedCard.length>0){

            table.dealer.openCards.push(table.dealer.blindedCard[0]);
            table.dealer.blindedCard.splice(0,1);

            var checkPoint = true;
            while(checkPoint){

                updateTotal(table);
                checkFinalTotal(table);
                sendUpdateToAllPlayer(tableIndex);
                var temp1=1;
                for(var j =0 ; table.players.length;j++){
                    if(table.players[j].status==="stand"){
                        temp1=0;
                        break;
                    }
                }


                if(temp1===0){
                    console.log("player still standing");
                    //Some player is still standing
                    table.dealer.openCards.push(getCardJSON(table.stack.cards[table.stackIndex]));
                    table.stackIndex=table.stackIndex+1;


                }
                else{
                    checkPoint=false;
                }
            }

        }




    }
}




io.on("connection",function(sct){
    console.log("connected");
    var playerId;
    sct.on("disconnect",function(){

        console.log("disconnecting"+playerId);
        var tableIndex = findPlayerTable(playerId);
        removePlayerFromTable(playerId);
        delete sockets[playerId];
        delete playerSocket[sct];
        sendUpdateToAllPlayer(tableIndex);
        removeEmptyTable();



    });
    sct.on("deal",function(data){

        playerId=data;
        var tableIndex = findPlayerTable(playerId);

        var player = findPlayer(playerId);

        deal(player,tables[tableIndex]);
        //   var liveTable = getLiveTable(playerId,tableIndex);
        sendUpdateToAllPlayer(tableIndex);

    });
    sct.on("hit",function(data){
        playerId=data;
        var tableIndex = findPlayerTable(playerId);
        var player = findPlayer(playerId);

        hit(player,tables[tableIndex]);
        // var liveTable = getLiveTable(playerId,tableIndex);
        sendUpdateToAllPlayer(tableIndex);

    });
    sct.on("stand",function(data){
        playerId=data;
        var tableIndex=findPlayerTable(playerId);
        var player = findPlayer(playerId);
        stand(player,tables[tableIndex]);
    });

    sct.on("AddMe",function(data){
        var player;
        playerId=data.playerId;
        var table =findPlayerTable(data.playerId);

        if(table===null){
            console.log("table is null");
            table= game.findTableForMe(tables);
            player = JSON.parse(JSON.stringify(data));
            player.cards =[];
            if(table.dealer.openCards.length>0){
                player.status="standby"
            }else{
                player.status="waiting";
            }

            player.total1 =0;
            player.total2 = 0;
            sockets[player.playerId]=sct;
            playerSocket[sct]=player.playerId;
            game.addMeToTable(player,table);

        }
        else{

            //console.log(table);
            player = findPlayer(data.playerId);

        }
        //  var liveTable=getLiveTable(player.playerId,findTableIndex(table.tableName));
        // console.log(tables[0].players[0]);
        var tableIndex = findPlayerTable(player.playerId);

        sendUpdateToAllPlayer(tableIndex);

        //io.socket(sct.id).emit("added",liveTable);
        //sct.emit("added",liveTable);   


    });

    /*
sct.on("error",function(err){
   console.log(err); 
});*/

});


