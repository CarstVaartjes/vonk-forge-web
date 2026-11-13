const number = new Intl.NumberFormat("en");

export interface BarPoint {
  // The date range the bar stands for, as words ("24 Jul to 30 Jul").
  range: string;
  count: number;
}

// One small bar chart: a single series, no legend (the title names it), a direct label on the peak and
// the newest bar. The bars are drawn for the eye (hover shows the range and count); the totals in the
// group's label and a visually hidden table carry the same data for everyone else.
export function BarSeries({ title, noun, points, axis }: { title: string; noun: [singular: string, plural: string]; points: BarPoint[]; axis: [string, string] }) {
  const max = Math.max(...points.map((point) => point.count));
  const peak = points.findIndex((point) => point.count === max);
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const newest = points.length - 1;
  return (
    <figure className="bar-series" role="group" aria-label={`${title}: ${number.format(total)} ${total === 1 ? noun[0] : noun[1]}, peak ${number.format(max)} in ${points[peak]?.range}`}>
      <ul className="bars" aria-hidden="true">
        {points.map((point, index) => (
          <li key={point.range} className="bar" data-newest={index === newest ? "" : undefined} data-empty={point.count === 0 ? "" : undefined} style={{ height: `${max === 0 ? 0 : (point.count / max) * 100}%` }}>
            {index === peak || index === newest ? <em>{number.format(point.count)}</em> : null}
            <span className="bar-tip">{point.range}: {number.format(point.count)}</span>
          </li>
        ))}
      </ul>
      <div className="bars-axis" aria-hidden="true"><span>{axis[0]}</span><span>{axis[1]}</span></div>
      <div className="visually-hidden"><table>
        <caption>{title}</caption>
        <thead><tr><th scope="col">Dates</th><th scope="col">{noun[1]}</th></tr></thead>
        <tbody>{points.map((point) => <tr key={point.range}><td>{point.range}</td><td>{number.format(point.count)}</td></tr>)}</tbody>
      </table></div>
    </figure>
  );
}
