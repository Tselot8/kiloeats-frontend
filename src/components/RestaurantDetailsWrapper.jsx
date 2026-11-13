import { useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useStudentBrowsing } from '../hooks/useStudentBrowsing.js';
import { browsePath, findCampus, restaurantPath } from '../utils/studentBrowsing.js';
import { CampusCoverage, CampusSelect, StudentDemoNotice } from './StudentBrowsingShared.jsx';
import FoodImage from './FoodImage.jsx';
import { useCart } from '../context/CartContext.js';

const RestaurantDetailsWrapper = ({ service }) => {
  const { restaurantId } = useParams();
  const [params] = useSearchParams();
  const campusId = params.get('campus') || '';
  const campusSelectRef = useRef(null);
  const headingRef = useRef(null);
  const { status, data, retry, notFound } = useStudentBrowsing('menu', campusId, restaurantId, service);
  const restaurant = data?.restaurant;
  const { add } = useCart();
  return (
    <section className="student-page" aria-labelledby="student-menu-title">
      <div className="student-menu-page-heading"><h2 ref={headingRef} tabIndex={-1} id="student-menu-title">Restaurant menu</h2><Link className="button-link button-secondary student-back-link" to={browsePath(campusId)}>Back to restaurants</Link></div>
      <StudentDemoNotice />
      <CampusSelect selectRef={campusSelectRef} />
      {status === 'loading' && <p className="menu-state" role="status">Loading sample menu…</p>}
      {status === 'error' && (notFound ? <div className="menu-state" role="status"><h3>Demo restaurant not found</h3><p>This link doesn’t match a sample restaurant. Use “Back to restaurants” to find one for your campus.</p></div> : <div className="menu-feedback menu-feedback-error" role="alert"><p>The demo menu couldn’t be loaded. Please try again.</p><button className="button-secondary" onClick={() => { headingRef.current?.focus(); retry(); }}>Retry loading menu</button></div>)}
      {status === 'ready' && <>
        <div className="student-restaurant-overview"><FoodImage src={restaurant.image} name={restaurant.name} /><div><p className="auth-eyebrow">Sample restaurant</p><h3>{restaurant.name}</h3><p>{restaurant.description}</p><CampusCoverage campusIds={restaurant.campusIds} /></div></div>
        {['choose-campus', 'invalid-campus', 'unsupported-campus'].includes(data.state) && <div className="menu-state student-menu-recovery">
          <h3>{data.state === 'unsupported-campus' ? `This restaurant doesn’t serve ${data.campus.name}` : 'Choose a supported campus to see the menu'}</h3>
          <p>Explore this sample menu for:</p><div className="container1">{restaurant.campusIds.map((id) => <Link key={id} className="button-link button-secondary" onClick={() => campusSelectRef.current?.focus()} to={restaurantPath(restaurant.id, id)}>{findCampus(id).name}</Link>)}</div>
        </div>}
        {data.state === 'unavailable' && <div className="menu-state"><h3>Demo menu unavailable</h3><p>This sample menu is unavailable. Return to the restaurants list to explore another kitchen.</p></div>}
        {data.state === 'ready' && <section aria-labelledby="student-food-heading">
          <div className="student-results-heading"><h3 id="student-food-heading">Sample menu for {data.campus.name}</h3><p>Illustrative prices in ETB</p></div>
          {data.items.length === 0 ? <div className="menu-state"><h4>No food listed yet</h4><p>This restaurant’s sample menu is empty. Try another demo restaurant.</p></div> : <div className="student-food-grid">
            {data.items.map((item) => <article key={item.id} className={`student-food-card${item.available ? '' : ' student-food-unavailable'}`}>
              <FoodImage src={item.image} name={item.name} /><div className="student-food-body"><h4>{item.name}</h4><p>{item.description}</p><div className="student-food-meta"><span className="student-food-price">{new Intl.NumberFormat('en-ET', { maximumFractionDigits: 2 }).format(item.price)} ETB</span><span className={`student-food-availability${item.available ? ' is-available' : ''}`}>{item.available ? 'Available' : 'Unavailable'}</span></div>{item.available ? <button className="student-add-to-cart" type="button" aria-label={`Add to cart: ${item.name}`} onClick={() => add({ restaurantId: restaurant.id, campusId: data.campus.id, itemId: item.id })}>Add to cart</button> : <p className="student-unavailable-note">Unavailable food cannot be added to the demo cart.</p>}</div>
            </article>)}
          </div>}
        </section>}
      </>}
    </section>
  );
};

RestaurantDetailsWrapper.propTypes = {
  service: (props) => props.service != null && typeof props.service.getRestaurantMenu !== 'function' ? new Error('Menus require a read service.') : null,
};

export default RestaurantDetailsWrapper;
