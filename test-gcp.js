const { InstancesClient } = require('@google-cloud/compute');

async function test() {
  try {
    console.log('Creating client...');
    const client = new InstancesClient();
    console.log('Client created, calling list...');
    const zone = 'us-central1-a';
    const request = {
      project: 'gen-lang-client-0084046183',
      zone: zone,
      maxResults: 1,
    };
    await client.list(request);
    console.log('Success!');
  } catch (error) {
    console.error('Caught error:', error.message);
  }
}

test();
