process.env.DB_DATABASE = 'test_files_manager';

const db = require('../utils/db');
const chai = require('chai');
const expect = chai.expect;
const waitConnection = () => {
  return new Promise((resolve, reject) => {
    let i = 0;
      const repeatFct = async () => {
        await setTimeout(() => {
          i += 1;
          if (i >= 10) {
            reject();
          }
          else if(!db.isAlive()) {
            repeatFct();
          }
          else {
            resolve();
          }
        }, 1000);
      };
      repeatFct();
  });
};

describe('Tests for Mongodb', () => {
  before(async () => {
    await waitConnection();
  });

  it('test connection to database server', () => {
    expect(db.isAlive()).to.be.true;
  });

  it('test user count', async () => {
    const n = await db.nbUsers();
    await db.uploadUser({ name: 'Opeyemi', email: 'ope@yemi.com', envType: 'test' });
    await db.uploadUser({name: 'Temitope', email: 'temi@tope.com', envType: 'test' });
    expect(await db.nbUsers()).to.equal(n + 2);
    await db.uploadUser({name: 'Ayomide', email: 'ayo@mide.com', envType: 'test' });
    expect(await db.nbUsers()).to.equal(n + 3);
    db.db.collection('users').deleteMany({ envType: 'test'});
  });

  it('test file count', async () => {
    const n = await db.nbFiles();
    await db.uploadFile({ name: 'file.txt', type: 'file', envType: 'test' });
    await db.uploadFile({ name: 'home', type: 'folder', envType: 'test' });
    expect(await db.nbFiles()).to.equal(n + 2);
    await db.uploadFile({ name: 'image.png', type: 'image', envType: 'test' });
    await db.uploadFile({ name: 'image1.png', type: 'image', envType: 'test' });
    expect(await db.nbFiles()).to.equal(n + 4);
    db.db.collection('files').deleteMany({ envType: 'test'});
  });
});
