/* Neustadter Kompanie: schlanker, eigenständiger PDF-Generator.
   Die Formularwerte werden ausschließlich lokal im Browser verarbeitet.
   Der PDF-Export benötigt keine externe Bibliothek oder Netzwerkschnittstelle. */
(() => {
  'use strict';
  const form = document.getElementById('applicationForm');
  const familyBlock = document.getElementById('familyFields');
  const familyNames = document.getElementById('familie');
  const lastStep = document.getElementById('lastStep');
  const result = document.getElementById('result');
  const submitButton = document.getElementById('submitButton');
  if (!form) return;

  const typeInputs = [...form.querySelectorAll('input[name="typ"]')];
  function selectedType() { return typeInputs.find(input => input.checked)?.value || 'einzel'; }
  function updateType() {
    const family = selectedType() === 'familie';
    typeInputs.forEach(input => input.closest('.choice').classList.toggle('selected',input.checked));
    familyBlock.hidden = !family;
    familyNames.required = family;
    lastStep.textContent = family ? '4' : '3';
    result.hidden = true;
  }
  typeInputs.forEach(input => input.addEventListener('change', updateType));
  updateType();

  // CP1252 / WinAnsi: deutsche Umlaute und Eurozeichen werden im PDF korrekt kodiert.
  function winAnsiHex(text) {
    const special = new Map([[0x20ac,0x80],[0x201a,0x82],[0x0192,0x83],[0x201e,0x84],
      [0x2026,0x85],[0x2020,0x86],[0x2021,0x87],[0x02c6,0x88],[0x2030,0x89],
      [0x0160,0x8a],[0x2039,0x8b],[0x0152,0x8c],[0x017d,0x8e],[0x2018,0x91],
      [0x2019,0x92],[0x201c,0x93],[0x201d,0x94],[0x2022,0x95],[0x2013,0x96],
      [0x2014,0x97],[0x02dc,0x98],[0x2122,0x99],[0x0161,0x9a],[0x203a,0x9b],
      [0x0153,0x9c],[0x017e,0x9e],[0x0178,0x9f]]);
    let hex = '';
    for (const ch of String(text).normalize('NFC')) {
      const cp = ch.codePointAt(0);
      const byte = special.get(cp) ?? ((cp >= 32 && cp <= 126) || (cp >= 160 && cp <= 255) ? cp : 63);
      hex += byte.toString(16).padStart(2,'0').toUpperCase();
    }
    return hex;
  }
  function safe(v) { return String(v || '').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim(); }
  function limit(v, n = 67) { const s=safe(v); return s.length > n ? s.slice(0,n-1)+'…' : s; }
  function sanitizeFilename(name) { return safe(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]/g,'-').replace(/-+/g,'-').slice(0,60) || 'Mitglied'; }

  function generateCommands(data, hasLogo) {
    const c = [];
    function rect(x,y,w,h,rgb) { c.push(`${rgb.join(' ')} rg ${x} ${y} ${w} ${h} re f\n`); }
    function stroke(x1,y1,x2,y2,rgb=[.85,.82,.76],width=.7){c.push(`${rgb.join(' ')} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S\n`);}
    function t(x,y,value,size=10,bold=false,color=[.16,.23,.19]) {
      c.push(`BT /${bold?'F2':'F1'} ${size} Tf ${color.join(' ')} rg 1 0 0 1 ${x} ${y} Tm <${winAnsiHex(value)}> Tj ET\n`);
    }
    function label(x,y,k,v,max=84){t(x,y,k,8.5,true,[.42,.47,.43]);t(x,y-17,limit(v,max),11.5,false);}
    function section(y,title){ rect(43,y-6,509,26,[.96,.94,.88]);rect(43,y-6,4,26,[.53,.24,.23]);t(56,y+3,title,10,true,[.10,.23,.19]); }
    // A4 - 595 × 842 pt.
    rect(0,0,595,842,[.995,.992,.976]);
    rect(0,810,595,32,[.07,.18,.15]);
    rect(0,794,595,16,[.53,.24,.23]);
    t(44,824,'NEUSTADTER KOMPANIE N.E.V.',11.5,true,[1,1,1]);
    t(44,765,'Antrag auf Fördermitgliedschaft',21,true,[.10,.23,.19]);
    t(45,746,'Gemeinsam für unseren historischen Wagen.',10,false,[.47,.49,.43]);
    if(hasLogo) c.push('q 55 0 0 55 492 724 cm /Im1 Do Q\n');
    stroke(44,717,551,717,[.77,.66,.44],1.2);

    section(685,'01  GEWÜNSCHTE FÖRDERMITGLIEDSCHAFT');
    const single = data.typ === 'einzel';
    t(57,649,`${single?'[X]':'[ ]'} Einzel-Fördermitgliedschaft – 25 € jährlich`,12,single,[.13,.25,.2]);
    t(57,628,`${!single?'[X]':'[ ]'} Familien-Fördermitgliedschaft – 30 € jährlich`,12,!single,[.13,.25,.2]);
    t(57,610,'Einzel: 24 € Jahresbeitrag + 1 € Bearbeitungsgebühr pro Jahr.',8.7,false,[.42,.47,.42]);

    section(579,'02  PERSÖNLICHE ANGABEN');
    label(52,550,'Vor- und Nachname',data.vorname + ' ' + data.nachname);
    label(52,513,'Straße und Hausnummer',data.strasse);
    label(52,476,'Postleitzahl und Ort',data.plz + ' ' + data.ort);
    label(52,439,'E-Mail-Adresse',data.email,82);
    label(52,402,'Telefon (freiwillig)',data.telefon || '–');

    const names = data.familie || [];
    if(data.typ === 'familie') {
      section(350,'03  WEITERE FAMILIENMITGLIEDER');
      if(names.length) names.forEach((name,i)=>t(54,321-(i*15),`${i+1}. ${limit(name,87)}`,9.4));
      else t(54,321,'Keine weiteren Personen angegeben',9.4);
    }
    const legalY = data.typ === 'familie' ? 191 : 276;
    section(legalY,'ERKLÄRUNG');
    t(52,legalY-35,'Hiermit beantrage ich die Fördermitgliedschaft in der Neustadter Kompanie n.e.V.',9.4);
    t(52,legalY-51,'zur oben ausgewählten Jahresgebühr. Die Bearbeitung erfolgt',9.4);
    t(52,legalY-67,'nach Eingang des unterschriebenen Antrags; der Verein bestätigt die Aufnahme.',9.4);
    const signY = data.typ === 'familie' ? 68 : 118;
    stroke(52,signY,265,signY,[.34,.41,.37],.9);
    stroke(324,signY,540,signY,[.34,.41,.37],.9);
    t(52,signY-14,'Ort, Datum',8,false,[.47,.5,.46]);
    t(324,signY-14,'Unterschrift der antragstellenden Person',8,false,[.47,.5,.46]);
    stroke(44,34,550,34,[.82,.81,.76],.7);
    t(45,20,'Neustadter Kompanie n.e.V.  ·  info@neustadter-kompanie.de',8,false,[.39,.46,.4]);
    return c.join('');
  }

  const encoder = new TextEncoder();
  function makePDF(commandText, jpeg) {
    const count = jpeg ? 7 : 6;
    const objects = new Array(count+1);
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    objects[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> ${jpeg?'/XObject << /Im1 7 0 R >>':''} >> /Contents 4 0 R >>`;
    const content = encoder.encode(commandText);
    objects[4] = [`<< /Length ${content.length} >>\nstream\n`,content,'\nendstream'];
    objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[6] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    if (jpeg) objects[7] = [`<< /Type /XObject /Subtype /Image /Width 640 /Height 640 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,jpeg,'\nendstream'];
    const chunks=[];let offset=0;
    function push(p){ const bytes=(typeof p==='string')?encoder.encode(p):p;chunks.push(bytes);offset+=bytes.length; }
    push('%PDF-1.4\n');
    const offsets=[0];
    for(let i=1;i<=count;i++) {
      offsets[i]=offset;
      push(`${i} 0 obj\n`);
      const obj=objects[i];
      if(Array.isArray(obj)) obj.forEach(push); else push(obj);
      push('\nendobj\n');
    }
    const xref=offset;
    push(`xref\n0 ${count+1}\n0000000000 65535 f \n`);
    for(let i=1;i<=count;i++) push(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
    push(`trailer\n<< /Size ${count+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(chunks,{type:'application/pdf'});
  }
  // Logo mit Transparenz für die PDF-Seite auf Papierfarbe darstellen.
  // Nur für den PDF-Export erfolgt die JPEG-Konvertierung lokal im Browser.
  async function loadLogo(){
    try{
      // Verwende das bereits eingebettete freigestellte Wappen aus der Kopfzeile.
      // So funktioniert die PDF auch ohne separate PNG-Datei in GitHub.
      const image = document.querySelector('header .brand img');
      if (!image) throw new Error('Wappen-Element nicht gefunden');
      if (!image.complete || image.naturalWidth === 0) await image.decode();
      if (!image.naturalWidth) throw new Error('Wappen konnte nicht geladen werden');
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');
      if(!ctx) return null;
      ctx.fillStyle = '#fffefa';
      ctx.fillRect(0,0,640,640);
      ctx.drawImage(image,0,0,640,640);
      const jpeg = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',.92));
      if(!jpeg) return null;
      return new Uint8Array(await jpeg.arrayBuffer());
    }catch(error){ console.warn('Vereinslogo konnte nicht geladen werden.',error); return null; }
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!form.reportValidity()) return;
    const names=safe(familyNames.value) ? familyNames.value.split(/\r?\n/).map(safe).filter(Boolean):[];
    if(selectedType()==='familie' && names.length>8){
      familyNames.setCustomValidity('Bitte maximal acht weitere Familienmitglieder eintragen. Für größere Familien kontaktiere uns per E-Mail.');
      familyNames.reportValidity();
      familyNames.addEventListener('input',()=>familyNames.setCustomValidity(''),{once:true});
      return;
    }
    const read=name=>safe(form.elements.namedItem(name).value);
    const data={typ:selectedType(),vorname:read('vorname'),nachname:read('nachname'),
      strasse:read('strasse'),plz:read('plz'),ort:read('ort'),
      email:read('email'),telefon:read('telefon'),familie:names};
    submitButton.disabled=true;submitButton.textContent='PDF wird erstellt …';
    try{
      const logo=await loadLogo();
      if (!logo) throw new Error('Das Vereinswappen fehlt oder konnte nicht geladen werden.');
      const blob=makePDF(generateCommands(data,true),logo);
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=url;
      link.download=`Foerdermitgliedsantrag-Neustadter-Kompanie-${sanitizeFilename(data.nachname)}.pdf`;
      document.body.appendChild(link);
      link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      result.hidden=false;
      result.scrollIntoView({behavior:'smooth',block:'nearest'});
    }catch(error){
      console.error('PDF konnte nicht erstellt werden:',error);
      alert('Der PDF-Download hat leider nicht funktioniert. Bitte lade die Seite neu oder kontaktiere info@neustadter-kompanie.de.');
    }finally{submitButton.disabled=false;submitButton.textContent='Fördermitgliedsantrag als PDF herunterladen ↓';}
  });
})();
