#!/usr/bin/env node

import fs from 'fs';
import { getToken } from './util/spotify.js';
import axios from 'axios';

// Function to get track information from Spotify
async function getTrackInfo(token, trackId) {
  try {
    const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const track = response.data;
    return {
      id: track.id,
      name: track.name,
      artist: track.artists.map(artist => artist.name).join(', '),
      album: track.album.name,
      duration_ms: track.duration_ms,
      external_urls: track.external_urls.spotify
    };
  } catch (error) {
    console.error(`Error getting track ${trackId}:`, error.response?.status, error.response?.data?.error?.message);
    return {
      id: trackId,
      name: 'TRACK NOT FOUND',
      artist: 'UNKNOWN',
      album: 'UNKNOWN',
      duration_ms: 0,
      external_urls: null,
      error: true
    };
  }
}

// Function to process sets and get track information
async function processSets(userData) {
  console.log('Getting Spotify access token...');
  const token = await getToken();
  console.log('Token obtained successfully\n');

  const results = [];

  for (const set of userData.sets) {
    console.log(`\n📀 Processing set: "${set.name}" (${set.tracks.length} tracks)`);
    console.log(`Created: ${new Date(set.created).toLocaleDateString()}`);
    console.log('─'.repeat(60));

    const setResult = {
      id: set.id,
      name: set.name,
      created: set.created,
      tracks: []
    };

    for (let i = 0; i < set.tracks.length; i++) {
      const track = set.tracks[i];
      console.log(`${(i + 1).toString().padStart(2, ' ')}. Getting track info for ${track.id}...`);
      
      const trackInfo = await getTrackInfo(token, track.id);
      
      const trackResult = {
        ...trackInfo,
        adjustment: track.adjustment,
        note: track.note,
        position: i + 1
      };
      
      setResult.tracks.push(trackResult);
      
      if (trackInfo.error) {
        console.log(`    ❌ ${trackInfo.name}`);
      } else {
        console.log(`    ✅ ${trackInfo.artist} - ${trackInfo.name}`);
        if (track.note) {
          console.log(`       📝 Note: ${track.note}`);
        }
        if (track.adjustment !== 0) {
          console.log(`       🎛️  Adjustment: ${track.adjustment > 0 ? '+' : ''}${track.adjustment}`);
        }
      }
      
      // Small delay to be nice to Spotify API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    results.push(setResult);
  }

  return results;
}

// Function to format and save results
function formatResults(results) {
  let output = '';
  
  for (const set of results) {
    output += `\n${'='.repeat(80)}\n`;
    output += `🎵 SET: ${set.name.toUpperCase()}\n`;
    output += `📅 Created: ${new Date(set.created).toLocaleDateString()}\n`;
    output += `🎵 Tracks: ${set.tracks.length}\n`;
    output += `${'='.repeat(80)}\n\n`;
    
    for (const track of set.tracks) {
      if (track.error) {
        output += `${track.position.toString().padStart(2, ' ')}. ❌ TRACK NOT FOUND (ID: ${track.id})\n`;
      } else {
        output += `${track.position.toString().padStart(2, ' ')}. ${track.artist} - ${track.name}\n`;
        output += `    Album: ${track.album}\n`;
        output += `    Duration: ${Math.floor(track.duration_ms / 60000)}:${((track.duration_ms % 60000) / 1000).toFixed(0).padStart(2, '0')}\n`;
        
        if (track.note) {
          output += `    📝 Note: ${track.note}\n`;
        }
        if (track.adjustment !== 0) {
          output += `    🎛️  Adjustment: ${track.adjustment > 0 ? '+' : ''}${track.adjustment}\n`;
        }
        output += `    🔗 ${track.external_urls || 'No URL available'}\n`;
      }
      output += '\n';
    }
  }
  
  return output;
}

// Main function
async function main() {
  try {
    const userFilePath = process.argv[2] || './data/users/auth0|645ba447fedcc09e6bc6042f';
    
    console.log(`Reading user data from: ${userFilePath}`);
    const userDataRaw = fs.readFileSync(userFilePath, 'utf8');
    const userData = JSON.parse(userDataRaw);
    
    console.log(`Found ${userData.sets.length} sets to process\n`);
    
    // Process all sets
    const results = await processSets(userData);
    
    // Format and save results
    const formattedOutput = formatResults(results);
    const outputFile = 'extracted_sets.txt';
    fs.writeFileSync(outputFile, formattedOutput);
    
    // Also save as JSON for potential future use
    const jsonOutputFile = 'extracted_sets.json';
    fs.writeFileSync(jsonOutputFile, JSON.stringify(results, null, 2));
    
    console.log(`\n✅ Extraction complete!`);
    console.log(`📄 Readable format saved to: ${outputFile}`);
    console.log(`📊 JSON format saved to: ${jsonOutputFile}`);
    
    // Print summary
    let totalTracks = 0;
    let errorTracks = 0;
    for (const set of results) {
      totalTracks += set.tracks.length;
      errorTracks += set.tracks.filter(t => t.error).length;
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Sets processed: ${results.length}`);
    console.log(`   Total tracks: ${totalTracks}`);
    console.log(`   Successfully retrieved: ${totalTracks - errorTracks}`);
    console.log(`   Errors: ${errorTracks}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}