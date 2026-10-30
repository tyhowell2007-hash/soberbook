import { redirect } from 'next/navigation';

/* 0194. An urgent-report push opens /admin/urgent so that public/sw.js can
   tell it apart from an ordinary report by its path alone (the payload
   carries nothing else, on purpose). The queue already puts urgent
   reports on top, so this just goes there. /admin does its own admin
   check; nobody else gets past it. */
export default function Urgent() {
  redirect('/admin');
}
