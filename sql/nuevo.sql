SELECT  
		pp.id,
		pp.identification_number as nro_documento,
		ident.id as tipo_documento_id,
		ident.name as tipo_documento,
		ident.code as tipo_documento_code,
		pp.cuil_cuit ,
		last_name as apellido, 
		pp.name as nombre, 
		case when pp.masculine=true then 'Hombre' else 'Mujer' end as genero,
		pp.masculine,
		bg.id as grupo_sanguineo_id,
		bg.name as grupo_sanguineo,
		bg.code as grupo_sang_code,
		bf.id as factor_rh_id,
		bf.name as factor_rh,
		bf.code as factor_rh_code,
		pp.birth_date as nac,
		pp.birth_date as nac_dia,
		nac.citizenship as nacionalidad,
		nac.id as nacionalidad_id,
		dire.city_nac as ciudad_nacimiento,
		dire.pais_nac as pais_nacimiento,
		dire.postal_code,
		dire_actual.*,
		adm_last.id as last_adm_id,
		adm_last.period_id ,
		adm_last.number as period,
		adm_last.year_calendar as year_admission,
		adm_last.turno,
		adm_last.turno_id,
		st.id as student_id
		
FROM 	yacare.physical_person pp
JOIN 	yacare.student st 
on 		pp.id=st.physical_person_id
left JOIN 	
		yacare.blood_group bg 
on 		bg.id=pp.blood_group_id
left JOIN 	
		yacare.blood_factor bf 
on 		bf.id=pp.blood_factor_id
join 	yacare.identification_type_person ident 
on 		ident.id=pp.identification_type_person_id
left JOIN 
		( 
		select 	city.id, 
				city.name as city_nac, 
				dsc.name as department_nac, 
				sc.name as provincia_nac,
				ct.name as pais_nac,
				ct.id as pais_nac_id,
				city.postal_code
		from 	yacare.city city 
		left join 
				yacare.department_state_country dsc 
		on 		dsc.id=city.department_state_country_id
		left join 
				yacare.state_country sc 
		on 		sc.id=dsc.state_country_id
		left join 
				yacare.country ct 
		on 		ct.id=sc.country_id 
		) dire 
on 		dire.id=pp.birth_address_id
left join 
		yacare.country nac 
on 		nac.id=pp.country_id
left join
		(
		select 	a.*,
				b.address_id
		from 
				(
				select  ppl.physical_person_id as  physical_person_add_id,
				   		aa.id as address_add_pers_id,
				   		aa.district_comment as barrio_dom_actual,
				   		aa.street_comment as calle_actual,
				   		aa.number as nro_dom_actual,
				   		aa.floor as piso_dom_actual,
				   		aa.flat as flat_dom_actual,
				   		aa.building as edificio_dom_actual,
				   		city.id as city_dom_actual_id,
				   		city.name as city_dom_actual,
				   		dsc.id as departamento_dom_actual_id,
				   		dsc.name as departamento_dom_actual,
				   		sc.id as provincia_dom_actual_id,
				   		sc.name as provincia_dom_actual,
				   		ct.id as pais_dom_actual_id,
				   		ct.name as pais_dom_actual
				from  	yacare.physical_person_address_list ppl
				join 	yacare.address aa 
				on 		ppl.address_id=aa.id 
						and aa.state_enable=true
				left join 
						yacare.city city 
				on 		city.id=aa.city_id
				left join 
						yacare.department_state_country dsc 
				on 		dsc.id=city.id
			   	left join 
						yacare.state_country sc 
				on 		sc.id=dsc.state_country_id
			   	left join 
						yacare.country ct 
				on 		ct.id=sc.country_id
				) a
		inner join 
			   	(
				select 	max(address_id) as address_id, 
						physical_person_id
				from 	yacare.physical_person_address_list 
			    group by 
			    		physical_person_id
				) b
		on 		a.address_add_pers_id=b.address_id
		) dire_actual 
on 		dire_actual.physical_person_add_id=pp.id


inner JOIN 
	(
		select adm.id,
adm.period_id,
adm.year_calendar,
per.number,
turno.name as turno,
turno.id  as turno_id,
adm.student_id
FROM yacare.admission_act adm
left JOIN
yacare.admission_act adm_prev
ON adm.student_id = adm_prev.student_id
and adm_prev.year_calendar = adm.year_calendar - 1
and adm_prev.state_enable = true
left join 
yacare.enrollment enr 
on enr.admission_act_id=adm_prev.id 
and enr.state_enable=true 
and enr.record=true
left join 
yacare.division_enrollment_list lst 
on lst.enrollment_id=enr.id
left join 
yacare.division div 
on div.id=lst.division_id
left join 
yacare.turn turno 
on turno.id=div.turn_id
inner join 
yacare.period  per 
on per.id=adm.period_id 
and per.state_enable=true
inner JOIN
(select student_id, max(year_calendar) as year_calendar
from yacare.admission_act
group by student_id
) last
ON last.student_id = adm.student_id
and last.year_calendar = adm.year_calendar
where	adm.record = true
	) adm_last
ON 	adm_last.student_id=st.id
WHERE pp.id='dc94fd1e-80fe-4ac3-a1ec-273e879981a1'