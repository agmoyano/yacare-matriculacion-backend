-----TUTORES

SELECT 	pp.id as physical_person_id,
		famRelShip.code_rel_fam,
		famRelShip.name_rel_fam, 
		tutores.*
FROM 	yacare.physical_person_family_relationship_list relFam 
JOIN 
	   (
	   	SELECT 	fr.*, 
	   			frt.code as code_rel_fam, 
	   			frt.name as name_rel_fam 
	   	from 	yacare.family_relationship fr
		JOIN 	yacare.family_relationship_type frt
		ON 		fr.family_relationship_type_id=frt.id
			  	AND fr.legal_responsibility=true 
			  	and fr.state_enable=true
		)	famRelship  
ON 		famRelship.id=relFam.family_relationship_id
JOIN 
	    (
	    SELECT 	pp.id as tutor_id, 
	    		pp.identification_number as dni,
				ident.name as tipo_identificacion,
				ident.code as code_identificacion,
				pp.cuil_cuit,
				last_name as apellido, 
				pp.name as nombre, 
				case when pp.masculine is null then '' when pp.masculine=true then 'Masculino' else 'Femenino' end as sexo,
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
				dire_actual.*,
				email_tutor.email_id, 
				email_tutor.email,
				phone_tutor.phone_id, 
				phone_tutor.phone
		FROM 	yacare.physical_person pp
		LEFT JOIN 
				yacare.blood_group bg 
		on 		bg.id=pp.blood_group_id
		LEFT JOIN 
				yacare.blood_factor bf 
		on 		bf.id=pp.blood_factor_id
		LEFT join 
				yacare.identification_type_person ident 
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
		  		on 		dsc.id=city.id
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
		   		select 	a.*
		   		from 
		   				(
		   				select 	ppl.physical_person_id as physical_person_add_id,
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
		   				on 		dsc.id=city.department_state_country_id
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
		       			group by physical_person_id
		       			) b
		   		on 		a.address_add_pers_id=b.address_id
				) dire_actual 
		on 		dire_actual.physical_person_add_id=pp.id
		LEFT JOIN 
				(
		   		select 	a.*
		   		from 
		   				(
		   				select 	email.name as email, 
		   						ppel.physical_person_id physical_person_email_id, 
		   						ppel.email_id
		   				from  	yacare.physical_person_email_list ppel
		   				join 	yacare.email email 
		   				on 		ppel.email_id=email.id 
		   						and email.state_enable=true
		   				) a
		   		inner join 
		      			(
		      			select 	max(email_id) as email_id, 
		      					physical_person_id
		       			from 	yacare.physical_person_email_list 
		       			group by 
		       					physical_person_id
		       			) b
		   		on 		a.email_id=b.email_id
				) email_tutor 
		ON 		email_tutor.physical_person_email_id=pp.id
		LEFT JOIN 
				(
		   		select 	a.*
		   		from 
		   				(
		   				select  phone.name as phone, 
		   						ppel.physical_person_id physical_person_phone_id, 
		   						ppel.phone_id
		   				from  	yacare.physical_person_phone_list ppel
		   				join 	yacare.phone 
		   				on 		ppel.phone_id=phone.id 
		   						and phone.state_enable=true
		   				) a
		   		inner join 
		      			(
		      			select 	max(phone_id) as phone_id, 
		      					physical_person_id
		       			from 	yacare.physical_person_phone_list 
		       			group by 
		       					physical_person_id
		       			) b
		   		on 		a.phone_id=b.phone_id
				) phone_tutor 
		ON 		phone_tutor.physical_person_phone_id=pp.id
		) tutores
ON 		famRelship.physical_person_id=tutores.tutor_id
inner JOIN
		yacare.physical_person pp
on 		relFam.physical_person_id = pp.id
inner JOIN 
		yacare.student st 
on 		pp.id=st.physical_person_id