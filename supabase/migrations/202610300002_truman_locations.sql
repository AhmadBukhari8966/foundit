begin;
alter table public.foundit_items drop constraint if exists foundit_items_location_check;
alter table public.foundit_items add constraint foundit_items_location_check check (location in ('West Campus Suites','Dr. Ruth W. Towne Museum & Visitors Center','McClain Hall','Baldwin Hall','Ophelia Parrish','Missouri Hall','REC Center','Pickler Memorial Library','Kirk Memorial','Kirk Building','Student Union Building','Centennial Hall','BNB Hall','Magruder Hall','Violette Hall','Dobson Hall','General Services Building','Ryle Hall','Pershing Building','Health Sciences Building','Stokes Stadium','Barnett Hall','Campbell Apartments','Student Center','Library','Engineering Hall'));
commit;
