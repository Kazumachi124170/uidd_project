const express = require('express')
const mongoose = require('mongoose')
const config = require('./config')
const path = require('path')
const crypto = require('crypto')
const cmd=require('node-cmd');
const url = `mongodb://${config.mongodb.user}:${config.mongodb.password}@${config.mongodb.host}/${config.mongodb.database}`
const conn = mongoose.createConnection(url, { useNewUrlParser: true, useUnifiedTopology: true }, (err, res) => {
    if (err) console.log('fail to connect:', err)
});
mongoose.Promise = global.Promise
mongoose.Promise = require('bluebird');
const session = require('express-session')
const bodyParser = require('body-parser')
var port = 7575;
var fs = require('fs')
var keyPath = './ssl/private.key';
var certPath = './ssl/certificate.crt';
var hskey = fs.readFileSync(keyPath);
var hscert = fs.readFileSync(certPath);
var https = require('https')
var multer = require('multer');
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, `${__dirname}/public/image`)
    },
    filename: function (req, file, cb) {
        crypto.pseudoRandomBytes(16, function (err, raw) {
            if (err) return cb(err)

            cb(null, raw.toString('hex') + path.extname(file.originalname))
        })
    }
});
var upload = multer({ storage: storage, limits: { fileSize: 10000000 } });
const app = express()
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }))
app.use(bodyParser.json({ limit: '50mb' }))
app.use(session({
    secret: 'uiddgroupK',
    cookie: { maxAge: 60 * 10000 }
}));
let allowCrossDomain = function (req, res, next) {
    res.header('Access-Control-Allow-Origin', 'https://luffy.ee.ncku.edu.tw');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    next();
}
app.use(allowCrossDomain);
var server = https.createServer({
    key: hskey,
    cert: hscert
}, app);
server.listen(port, function () {
    console.log('runing Web Server in ' + port + ' port...');
});

//user schema
const userCollectionName = 'user'
const userSchema = new mongoose.Schema({
    name: String,
    password: String,
    email: String,
    designer: Boolean,
    room: Number,
    hall: Number,
    bath: Number,
    suite: Boolean,
    tags: [{
        type: String
    }]
}, { collection: userCollectionName });
const userModel = conn.model(userCollectionName, userSchema);

const postCollectionName = 'post'
const postSchema = new mongoose.Schema({
    name: String,
    user_icon: String,
    post_icon: String,
    title: String,
    explanation:String,
    space:String,
    room:String,
    pings:Number,
    tags:[{
        type: String
    }],
    published: Boolean
}, { collection: postCollectionName });
const postModel = conn.model(postCollectionName, postSchema);
const saveAll = (data, model) => {
    for (d of data) {
        const m = new model(d)
        m.save((err) => {
            if (err) {
                console.log('fail to insert:', err)
                conn.close()
                process.exit()
            }
        })
    }
}

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    return res.sendFile(path.join(__dirname, 'public/login.html'));
})

app.get('/step1', (req, res) => {
    res.send('hello world')
})

app.get('/gitpull',(req,res)=>{
    cmd.get(
        `
            git pull
        `,
        function(err, data, stderr){
            if (!err) {
                res.send(data);
            } else {
                res.send(err);
            }
 
        }
    );
})

//login route for user login
app.post('/login', async (req, res) => {
    const login = async function () {
        return new Promise(async (resolve, reject) => {
            try {
                await userModel.findOne({ 'name': req.body.username, 'password': req.body.password }).exec(async (err, res) => {
                    if (err) {
                        console.log('fail to query:', err)
                        resolve(false)
                        return;
                    }
                    else {
                        if(!res) {
                            resolve(false)
                            return;
                        }
                        console.log(res.name + ' have students ' + res.password)
                        req.session.username = res.name;
                        //console.log(res.tags.length == 0);
                        if (res.tags.length === 0) {
                            resolve('first')
                        } else {
                            resolve(true)
                        }
                        //conn.close()
                    }
                })
            } catch (err) {
                console.log(err)
                reject(false)
                return;
            }
        })
    };
    login().then(r => {
        if (r === true) {
            res.send(JSON.parse(`{
                "success": true,
                "text": "login success, ${req.body.username}",
                "first_time":false
              }`))
        }
        else if (r === false) {
            res.send(JSON.parse(`{
                "success": false,
                "text": "Sorry, login fail",
                "first_time":false
              }`))
        }
        else if (r === 'first') {
            res.send(JSON.parse(`{
                "success": true,
                "text": "login success, ${req.body.username}",
                "first_time":true
              }`))
        }
        else {
            console.log(r)
            res.send(JSON.parse(`{
                "success": false,
                "text": ${r},
                "first_time":false
              }`))
        }
    })

})
//register route for user register
app.post('/register', (req, res) => {
    data = {
        'name': req.body.username, 'password': req.body.password, 'email': req.body.email, 'designer': Boolean(req.body.designer),
        'room': Number(req.body.room), 'hall': Number(req.body.hall), 'bath': Number(req.body.bath), 'suite': Boolean(req.body.suite)
    }
    console.log(`${req.session.username} login`)
    req.session.username = req.body.username;
    //saveAll(data, userModel)
    const m = new userModel(data)
    m.save((err) => {
        if (err) {
            console.log('fail to insert:', err)
            res.send(JSON.parse(`{
                "success": false,
                "text": "Sorry, register fail"
              }`))
        } else {
            // Response
            res.send(JSON.parse(`{
                "success": true,
                "text": "Registration success, ${req.body.username}"
              }`))
        }
    })
})
//check_login route for session check login
app.get('/check_login', (req, res) => {
    console.log(`${req.session.username} check login`)
    if (req.session.username === undefined) {
        res.send(JSON.parse(`{
            "success": false,
            "text": "session username is undefined"
          }`));
    }
    else {
        res.send(JSON.parse(`{
            "success": true,
            "text": "Had login with ${req.session.username}"
          }`));
    }
})
//modify the tags in user information
app.post('/modify_tags', (req, res) => {
    if (req.session.username === undefined) {
        res.send(JSON.parse(`{
            "success": false,
            "text": "session username is undefined"
          }`));
    } else {
        const modify = async function () {
            return new Promise(async (resolve, reject) => {
                try {
                    await userModel.findOne({ 'name': req.session.username }).exec(async (err, res) => {
                        if (err) {
                            console.log('fail to query:', err)
                            resolve(false)
                        }
                        else {
                            res.tags = req.body.tags;
                            res.save(function (err) {
                                if (err) {
                                    console.log(err);
                                }
                            });
                            //console.log(res.tags.length == 0);
                            resolve(true)
                        }
                    })
                } catch (err) {
                    reject(err)
                }
            })
        };
        modify().then(r => {
            if (r === true) {
                res.send(JSON.parse(`{
                    "success": true,
                    "text": "modify success, ${req.body.tags}"
                  }`))
            }
            else if (r === false) {
                res.send(JSON.parse(`{
                    "success": false,
                    "text": "Sorry, modify fail"
                  }`))
            }
            else {
                console.log(r)
            }
        })
    }
})
//Post an new post to sql,need 3 data:{user_icon,post_icon,title}
/*
name: String,
  user_icon:String,
  post_icon:String,
  title:String
*/
app.post('/add_post', (req, res) => {
    if (req.session.username === undefined) {
        res.send(JSON.parse(`{
            "success": false,
            "text": "session username is undefined"
          }`))
    } else {
        data = { 'name': req.session.username, 'user_icon': req.body.user_icon, 'post_icon': req.body.post_icon,
        'title': req.body.title ,'explanation':req.body.explanation,'space':req.body.space,'room':req.body.room,
        'pings':req.body.pings,'tags':req.body.tags,'published':true}
        const m = new postModel(data)
        m.save((err) => {
            if (err) {
                console.log('fail to insert:', err)
                res.send(JSON.parse(`{
                    "success": false,
                    "text": "Sorry, post fail"
                }`))
            } else {
                // Response
                res.send(JSON.parse(`{
                    "success": true,
                    "text": "Post success, ${req.session.username}"
                }`))
            }
        })
    }
})
//Get post for recommend post in homepage
app.get('/recommend', (req, res) => {
    data = new Array;
    const recommend = async function () {
        return new Promise(async (resolve, reject) => {
            try {
                await postModel.find({ 'published': true }).exec(async (err, res) => {
                    if (err) {
                        console.log('fail to query:', err)
                        resolve(false)
                    }
                    else {
                        res.forEach(r => {
                            data.push({
                                'name': r.name,
                                'user_icon': r.user_icon,
                                'post_icon': r.post_icon,
                                'title': r.title
                            })
                        })
                        data = JSON.stringify(data);
                        //console.log(data);
                        resolve(true)
                    }
                })
            } catch (err) {
                reject(err)
            }
        })
    };
    recommend().then(r => {
        if (r === true) {
            m = JSON.parse(`{
                "success": true,
                "text": "Query success",
                "object": ${data}
              }`)
            //console.log(m.object);
            res.json(m)
        }
        else if (r === false) {
            res.send(JSON.parse(`{
                "success": false,
                "text": "Sorry, query fail"
              }`))
        }
    })
})
//Upload single image and store in image/post
app.post('/upload', upload.single('file'), function (req, res, next) {
    //拼接檔案上傳後的網路路徑，
    var url = __dirname + '/public/image/post/' + req.file.filename;
    fs.rename(req.file.path, url, function(err) {
        if (err) {
          console.log(err);
          res.send(500);
        } else {
            res.json({
                success: true,
                data: 'image/post/'+req.file.filename
            });
        }
      });
    //將其發回客戶端
});