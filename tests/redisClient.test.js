const redis = require('../utils/redis');
const chai = require('chai');
const expect = chai.expect;

describe('Tests for redis', (done) => {
  it('test connection to redis server', () => {
    expect(redis.isAlive()).to.be.true;
  });

  it('test key/value caching', async () => {
    redis.set('name1', 'Opeyemi').then(async () => {
      expect(await redis.get('name1')).to.equal('Opeyemi');
    });
  });

  it('test key/value cache deletion', async () => {
    await redis.set('name2', 'Opeyemii');
    redis.del('name2').then(async () => {
       expect(await redis.get('name2')).to.equal(null);
    });
  });

  it('test key/value caching with timeout', async () => {
    await redis.set('name3', 'Temitope', 3000);
    await setTimeout(async () => {
      expect(await redis.get('name3')).to.not.equal('Temitope');
    }, 3000);
  });
});