import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStudentBrowsing } from '../hooks/useStudentBrowsing.js';
import { findCampus, restaurantPath } from '../utils/studentBrowsing.js';
import { CampusCoverage, CampusSelect, StudentDemoNotice } from './StudentBrowsingShared.jsx';
import FoodImage from './FoodImage.jsx';

const StudentBrowsePage = ({ service }) => {
  const [params] = useSearchParams();
  const campusId = params.get('campus') || '';
  const campus = findCampus(campusId);
  const resultsHeadingRef = useRef(null);
  const { status, data: restaurants, retry } = useStudentBrowsing('restaurants', campusId, undefined, service);
  return (
    <section className="student-page" aria-labelledby="student-browse-title">
      <div className="student-page-heading"><p className="auth-eyebrow">Meals around campus</p><h2 id="student-browse-title">Find your next study break</h2><p>Explore sample kitchens and cafés serving your campus.</p></div>
      <StudentDemoNotice />
      <CampusSelect />
      {!campus && <div className="menu-state"><h3>{campusId ? 'Choose a supported campus' : 'Start with your campus'}</h3><p>Select a campus above to discover its demo restaurants.</p></div>}
      {campus && <>
        <div className="student-results-heading"><h3 ref={resultsHeadingRef} tabIndex={-1}>Restaurants for {campus.name}</h3><p role="status">{status === 'loading' ? 'Loading sample restaurants…' : status === 'ready' ? `${restaurants.length} demo restaurant${restaurants.length === 1 ? '' : 's'}` : ''}</p></div>
        {status === 'error' && <div className="menu-feedback menu-feedback-error" role="alert"><p>Demo restaurants couldn’t be loaded. No restaurant availability has been confirmed.</p><button className="button-secondary" onClick={() => { resultsHeadingRef.current?.focus(); retry(); }}>Retry loading restaurants</button></div>}
        {status === 'ready' && (restaurants.length === 0 ? <div className="menu-state"><h3>No demo restaurants for this campus yet</h3><p>Choose another campus to explore the sample menus.</p></div> : <div className="student-restaurant-grid">
          {restaurants.map((restaurant) => <article className="student-restaurant-card" key={restaurant.id}>
            <FoodImage src={restaurant.image} name={restaurant.name} />
            <div className="student-restaurant-card-body"><h4>{restaurant.name}</h4><p>{restaurant.description}</p><CampusCoverage campusIds={restaurant.campusIds} />
              <Link className="button-link button-secondary" to={restaurantPath(restaurant.id, campus.id)} aria-label={`View sample menu for ${restaurant.name}`}>View sample menu <span aria-hidden="true">→</span></Link>
            </div>
          </article>)}
        </div>)}
      </>}
    </section>
  );
};

StudentBrowsePage.propTypes = {
  service: (props) => props.service != null && typeof props.service.listRestaurants !== 'function' ? new Error('Browsing requires a read service.') : null,
};

export default StudentBrowsePage;
