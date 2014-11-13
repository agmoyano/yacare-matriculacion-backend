----DATOS ESTUDIANTES
SELECT 	pp.id,
		pp.identification_number as dni,
		ident.name as tipo_identificacion,
		ident.code as code_identificacion,
		pp.cuil_cuit ,
		last_name as apellido, 
		pp.name as nombre, 
		case when pp.masculine=true then 'Masculino' else 'Femenino' end as sexo,
		pp.masculine,
		bg.name as grupo_sang_name,
		bg.code as grupo_sang_code,
		bf.name as factor_sang_name,
		bf.code as factor_sang_code,
		pp.birth_date as fecha_nac,
		nac.citizenship as nacionalidad,
		dire.city_nac,
		dire.department_nac,
		dire.provincia_nac,
		dire_actual.*
FROM 	yacare.physical_person pp
JOIN 	yacare.student st 
on 		pp.id=st.physical_person_id
JOIN 	yacare.blood_group bg 
on 		bg.id=pp.blood_group_id
JOIN 	yacare.blood_factor bf 
on 		bf.id=pp.blood_factor_id
join 	yacare.identification_type_person ident 
on 		ident.id=pp.identification_type_person_id
left JOIN 
		( 
		select 	city.id, 
				city.name as city_nac, 
				dsc.name as department_nac, 
				sc.name as provincia_nac,
				ct.name as pais_nac
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
				   		city.name as city_dom_actual,
				   		dsc.name as departamento_dom_actual,
				   		sc.name as provincia_dom_actual,
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
where	pp.id = $1