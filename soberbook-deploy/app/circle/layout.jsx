/* ⭕ The circle room. Same four stylesheets the other member rooms pull
   in, plus its own.

   🔴 IT RENDERS NavBar. A room layout is not finished until it does —
   /friends shipped on 19 Aug with no way out of it. */
import '../theme-green.css';
import '../photos.css';
/* ⚠️ Its own small file rather than a block in wall.css: that file is
   71KB and has silently failed three uploads in a row at that size.
   ⚠️ A stylesheet nothing imports is a silent failure this app has hit
   twice — this line IS the feature working. */
import '../circle.css';

import NavBar from '../components/NavBar';

export default function CircleLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
