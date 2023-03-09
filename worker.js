const Queue = require('bull');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs');
const fsP = require('fs/promises');
const sharp = require('sharp');
const db = require('./utils/db');

const fileQueue = new Queue('image transcoding');
console.log('Worker up!');
fileQueue.process(async (job, done) => {
  if (!job.data.fileId) {
    console.log('err');
    done(new Error('Missing fileId'));
  } else if (!job.data.userId) {
    done(new Error('Missing userId'));
  }
  console.log(job.data.fileId, job.data.userId);
  const file = await db.findFile({ _id: job.data.fileId.toString() });
  console.log(file);
  if (Object.keys(file).length > 0 && job.data.userId === file.userId.toString()) {
    const path = file.localPath;
    const widths = [500, 250, 100];
    if (fs.existsSync(`${path}/${file.name}`)) {
      const splitName = file.name.split('.');
      const metadata = sharp(`${path}/${file.name}`).metadata();
      if (splitName.length === 2) {
        for (const width of widths) {
          const options = {
            width,
            height: width * (metadata.height / metadata.width),
          };
          const image = await imageThumbnail(`${path}/${file.name}`, options);
          await fsP.writeFile(`${path}/${splitName[0]}_${width}.${splitName[1]}`, image);
        }
        console.log('done', job.data.fileId);
        done();
      } else {
        done(new Error('Invalid filename in local storage'));
      }
    } else {
      done(new Error('Not found'));
    }
  } else {
    done(new Error('File not found'));
  }
});

const userQueue = new Queue('Welcome user');
userQueue.process(async (job, done) => {
  if (!job.data.userId) {
    done(new Error('Missing userId'));
  }
  const user = await db.findUser({ _id: job.data.userId });
  if (Object.keys(user).length > 0) {
    console.log(`Welcome ${user.email}`);
    /** const mailgun = require("mailgun-js");
    const DOMAIN = 'sandboxa13982c7f1954a87b3a321d568812944.mailgun.org';
    const mg = mailgun({ apiKey: 'cac8989b7d5c3b7c50038736267c9cec-7764770b-5aaa85bc',
    domain: YOUR_DOMAIN_NAME });
    const data = {
	    from: 'Aphrotee <aphrotemitope37@gmail.com>',
	    to: user.email,
	    subject: 'Successful Registration on File Management Platform',
	    text: "Congratulations! You have succesfully registered to use Aphrotee's file management platform, you are most welcome to enjoy its awesomness!"
    };
    mg.messages().send(data, function (error, body) {
  	  console.log(body);
    }); */
  }
});

module.exports = { userQueue, fileQueue };
