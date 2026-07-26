/**
 * Random Joke Generator
 * Fetches jokes from JokeAPI (https://jokeapi.dev/)
 */

const https = require('https');

/**
 * Fetch a random joke from JokeAPI
 * @param {Object} options - Configuration options
 * @param {string} options.type - 'single' or 'twopart' (default: 'any')
 * @param {string} options.category - Category like 'general', 'programming', 'knock-knock', etc.
 * @returns {Promise<Object>} Joke object
 */
function getRandomJoke(options = {}) {
  return new Promise((resolve, reject) => {
    const type = options.type || 'any';
    const category = options.category || 'Any';
    
    const url = `https://v2.jokeapi.dev/joke/${category}?type=${type}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const joke = JSON.parse(data);
          
          if (joke.error) {
            reject(new Error(`API Error: ${joke.message}`));
          } else {
            resolve(joke);
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to fetch joke: ${error.message}`));
    });
  });
}

/**
 * Display joke in a formatted way
 * @param {Object} joke - Joke object from API
 */
function displayJoke(joke) {
  console.log('\n🎭 ' + '='.repeat(50));
  console.log(`Category: ${joke.category}`);
  
  if (joke.type === 'single') {
    console.log(`\n${joke.joke}`);
  } else {
    console.log(`\n${joke.setup}`);
    console.log(`\n${joke.delivery}`);
  }
  
  console.log('='.repeat(50) + '\n');
}

/**
 * Main function to get and display a random joke
 */
async function main() {
  try {
    // You can customize options here
    // Available categories: general, programming, knock-knock, etc.
    const joke = await getRandomJoke({ category: 'Programming' });
    displayJoke(joke);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { getRandomJoke, displayJoke };
