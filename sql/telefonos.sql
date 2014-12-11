----TELEFONOS DE EMERGENCIA
SELECT 	distinct pp.id,
		phone.id as tel_id, 
		phone.name as tel, 
		phone.comment as comentario
FROM 	yacare.physical_person pp 
JOIN 	yacare.physical_person_phone_list pppl 
ON 		pppl.physical_person_id=pp.id
JOIN 	yacare.phone phone 
on 		phone.id=pppl.phone_id 
		and phone.state_enable=true
WHERE 	pp.id=$1
