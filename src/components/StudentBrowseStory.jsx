import ethiopianPlatter from '../images/ethiopian/ethiopian-platter-photo.jpg';

// Decorative food motifs from the supplied reference, never category controls.
const foodMotifs = [
  { label: 'Sweet treats', paths: <><path d="M18 35h28l-5 20H23z" /><path d="M15 25h34v7H15z" /><path d="M21 25c-5-9 3-15 8-12 0-11 15-11 15 0 8 1 9 10 3 14" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /><path d="M31 17v8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></> },
  { label: 'Cool drinks', paths: <><path d="M18 25h29l-5 30H23z" /><path d="M16 17h33v5H16z" /><path d="m32 17 4-10 12-2" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /><path d="M28 37c3 5 8 5 11 0" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" /><circle cx="27" cy="31" r="1.7" fill="white" /><circle cx="39" cy="31" r="1.7" fill="white" /></> },
  { label: 'Quick bites', paths: <><path d="M10 25C12 5 51 5 54 25z" /><rect x="9" y="29" width="46" height="5" rx="2.5" /><path d="M10 39c8-9 13 8 22 0s15-2 22 0v5H10z" /><path d="M10 49h44c0 8-5 9-11 9H21c-6 0-11-1-11-9" /></> },
  { label: 'Food to share', paths: <><path d="M32 9a23 23 0 1 1-15 40l15-17z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" /><path d="m39 14-6 18 18 12M33 32l-9 21M33 32l20-7M33 32l10 21M33 32l1-21" fill="none" stroke="currentColor" strokeWidth="2.5" /><circle cx="42" cy="24" r="2.5" /><circle cx="43" cy="44" r="2.5" /><circle cx="27" cy="45" r="2" /><circle cx="45" cy="34" r="2" /><path d="m23 8-3 2m-6 6-2 3m-3 8v3m1 7 1 3m-1 7 3 2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></> },
];

const StudentBrowseStory = () => (
  <div className="campus-food-story">
    <section className="campus-food-band" aria-labelledby="campus-food-band-title">
      <ul className="campus-food-motifs">
        {foodMotifs.map(({ label, paths }) => <li key={label}>
          <span className="campus-food-icon"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">{paths}</svg></span>
          <span>{label}</span>
        </li>)}
      </ul>
      <h3 id="campus-food-band-title">A Simple Way To Explore<br />Ethiopian Food</h3>
      <p>From shiro and injera to a plate of firfir, find inspiration for your next campus meal. Explore sample menus for AAU 4K, AAU 5K, AAU 6K and Yared Music School.</p>
    </section>
    <section className="campus-food-feature" aria-labelledby="campus-food-feature-title">
      <figure className="campus-food-visual">
        <div className="campus-food-photo-ring"><img src={ethiopianPlatter} alt="Ethiopian platter with colourful stews, greens and a boiled egg" loading="lazy" width="900" height="601" /></div>
        <figcaption>Ethiopian platter · Tensu.12 · CC0</figcaption>
      </figure>
      <div className="campus-food-copy">
        <h3 id="campus-food-feature-title">Ethiopian <span>Food,</span><br />For Your<br /><span>Campus</span></h3>
        <p><strong>Sample restaurants and menus.</strong> These are synthetic examples, not real partners. Live ordering and delivery are not available.</p>
        <p>Planned delivery is restaurant-managed, with cash on delivery in ETB. Distance-based fees will be strictly below 100 ETB; exact fees are not set.</p>
        <p>Food photographs are illustrative examples, not photos of real restaurant partners.</p>
        <a className="button-link" href="/food-photo-credits.html">About this photo</a>
      </div>
    </section>
  </div>
);

export default StudentBrowseStory;
