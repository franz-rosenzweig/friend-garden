// The sample garden: twelve made-up people, so you can see how the garden
// looks after a few months. Dates are counted back from today, so there is
// always someone fresh, someone a bit thirsty and someone droopy.

import { addDays, uid } from './logic.js';

const PEOPLE = [
  { name: 'Captain Biscuit', group: 'close', plant: 'fern', rhythm: '2weeks', last: 4, count: 12, how: ['call', 'visit'],
    note: 'How did the sea shanty contest go?', notes: ['He finally named the boat.', 'Long call about the great pancake debate.'] },
  { name: 'Aunt Marmalade', group: 'family', plant: 'sunflower', rhythm: 'week', last: 10, count: 14, how: ['call', 'letter'],
    birthday: [3, 1956], note: 'The jam stall at the county fair', notes: ['She won a ribbon for the apricot one.'] },
  { name: 'Juniper Fizzwhistle', group: 'far', plant: 'olive', rhythm: 'month', last: 75, count: 4, how: ['voice', 'text'],
    note: 'Did the move to the lighthouse happen?', notes: ['Sent a voice note from the ferry.'] },
  { name: 'Professor Pickle', group: 'close', plant: 'cactus', rhythm: '3months', last: 40, count: 7, how: ['visit', 'letter'],
    note: 'How is the book about clouds coming along?', notes: ['Tea and far too many cloud photos.'] },
  { name: 'Dot Wobbleton', group: 'family', plant: 'tulip', rhythm: '2weeks', last: 17, count: 7, how: ['text', 'call'],
    birthday: [6, null], note: 'First week at the bakery', notes: [] },
  { name: 'Sir Reginald Teacup', group: 'far', plant: 'lavender', rhythm: 'month', last: 20, count: 8, how: ['letter', 'call'],
    note: '', notes: ['A postcard of the llama farm.'] },
  { name: 'Pip Moonbeam', group: 'close', plant: 'pothos', rhythm: 'week', last: 1, count: 16, how: ['text', 'voice', 'visit'],
    note: "The band's first gig!", notes: ['Practiced the harmonica song over the phone.', 'Picnic in the park.'] },
  { name: 'Grandpa Gooseberry', group: 'family', plant: 'wildflower', rhythm: 'week', last: 16, count: 9, how: ['call'],
    note: 'How the tomatoes did this year', notes: ['He read me the whole seed catalog.'] },
  { name: 'Clementine Quill', group: 'far', plant: 'tulip', rhythm: '3months', last: 120, count: 2, how: ['letter'],
    note: 'Her poetry zine', notes: [] },
  { name: 'Bartholomew Bun', group: 'close', plant: 'sunflower', rhythm: 'whenever', last: 30, count: 1, how: ['visit'],
    note: '', notes: ['Bumped into him at the hardware store.'] },
  { name: 'Hazel Thistlewick', group: 'family', plant: 'fern', rhythm: 'month', last: null, added: 3, count: 0, how: [],
    note: 'Ask about the new puppy', notes: [] },
  { name: 'Ozzie Puddleby', group: '', plant: 'wildflower', rhythm: '2weeks', last: 5, count: 4, how: ['text', 'call'],
    note: '', notes: ['Swapped bad jokes for an hour.'] },
];

const GAP = { week: 7, '2weeks': 13, month: 29, '3months': 85, whenever: 45 };

export function sampleFriends(today) {
  return PEOPLE.map((p, i) => {
    const touches = [];
    let date = p.last == null ? null : addDays(today, -p.last);
    for (let k = 0; k < p.count; k++) {
      touches.push({ id: uid() + k, date, how: p.how[k % p.how.length], note: p.notes[k] || '', t: k });
      date = addDays(date, -(GAP[p.rhythm] + ((i * 7 + k * 3) % 5) - 2));
    }
    let birthday = '';
    if (p.birthday) {
      const d = addDays(today, p.birthday[0]);
      birthday = p.birthday[1] ? `${p.birthday[1]}${d.slice(4)}` : d.slice(5);
    }
    const oldest = touches.length ? touches[touches.length - 1].date : addDays(today, -(p.added || 0));
    return {
      id: `sample-${i + 1}`, name: p.name, rhythm: p.rhythm, plant: p.plant, birthday, group: p.group,
      note: p.note, added: p.added != null ? addDays(today, -p.added) : addDays(oldest, -3), sample: true, touches,
    };
  });
}
