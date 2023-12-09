import {SQLConnection} from './SQLConnection';
import {PersonEntry} from './enitites/PersonEntry';
import {PersonDTO} from '../../../common/entities/PersonDTO';
import {Logger} from '../../Logger';
import {SQL_COLLATE} from './enitites/EntityUtils';
import {PersonJunctionTable} from './enitites/PersonJunctionTable';
import {IObjectManager} from './IObjectManager';

const LOG_TAG = '[PersonManager]';

export class PersonManager implements IObjectManager {
  persons: PersonEntry[] = null;
  /**
   * Person table contains denormalized data that needs to update when isDBValid = false
   */
  private isDBValid = false;

  private static async updateCounts(): Promise<void> {
    const connection = await SQLConnection.getConnection();
    await connection.query(
        'UPDATE person_entry SET count = ' +
        ' (SELECT COUNT(1) FROM person_junction_table WHERE person_junction_table.personId = person_entry.id)'
    );

    // remove persons without photo
    await connection
        .createQueryBuilder()
        .delete()
        .from(PersonEntry)
        .where('count = 0')
        .execute();
  }

  private static async updateSamplePhotos(): Promise<void> {
    const connection = await SQLConnection.getConnection();
    await connection.query(
        'update person_entry set sampleRegionId = ' +
        '(Select person_junction_table.id from  media_entity ' +
        'left join person_junction_table on media_entity.id = person_junction_table.mediaId ' +
        'where person_junction_table.personId=person_entry.id ' +
        'order by media_entity.metadataRating desc, ' +
        'media_entity.metadataCreationdate desc ' +
        'limit 1)'
    );
  }

  async updatePerson(
      name: string,
      partialPerson: PersonDTO
  ): Promise<PersonEntry> {
    this.isDBValid = false;
    const connection = await SQLConnection.getConnection();
    const repository = connection.getRepository(PersonEntry);
    const person = await repository
        .createQueryBuilder('person')
        .limit(1)
        .where('person.name LIKE :name COLLATE ' + SQL_COLLATE, {name})
        .getOne();

    if (typeof partialPerson.name !== 'undefined') {
      person.name = partialPerson.name;
    }
    if (typeof partialPerson.isFavourite !== 'undefined') {
      person.isFavourite = partialPerson.isFavourite;
    }
    await repository.save(person);

    await this.loadAll();

    return person;
  }

  public async getAll(): Promise<PersonEntry[]> {
    if (this.persons === null) {
      await this.loadAll();
    }
    return this.persons;
  }

  /**
   * Used for statistic
   */
  public async countFaces(): Promise<number> {
    const connection = await SQLConnection.getConnection();
    return await connection
        .getRepository(PersonJunctionTable)
        .createQueryBuilder('personJunction')
        .getCount();
  }

  public async get(name: string): Promise<PersonEntry> {
    if (this.persons === null) {
      await this.loadAll();
    }
    return this.persons.find((p): boolean => p.name === name);
  }

  public async saveAll(
      persons: { name: string; mediaId: number }[]
  ): Promise<void> {
    const toSave: { name: string; mediaId: number }[] = [];
    const connection = await SQLConnection.getConnection();
    const personRepository = connection.getRepository(PersonEntry);
    const personJunction = connection.getRepository(PersonJunctionTable);

    const savedPersons = await personRepository.find();
    // filter already existing persons
    for (const personToSave of persons) {
      const person = savedPersons.find(
          (p): boolean => p.name === personToSave.name
      );
      if (!person) {
        toSave.push(personToSave);
      }
    }

    if (toSave.length > 0) {
      for (let i = 0; i < toSave.length / 200; i++) {
        const saving = toSave.slice(i * 200, (i + 1) * 200);
        // saving person
        const inserted = await personRepository.insert(
            saving.map((p) => ({name: p.name}))
        );
        // saving junction table
        const junctionTable = inserted.identifiers.map((idObj, j) => ({person: idObj, media: {id: saving[j].mediaId}}));
        await personJunction.insert(junctionTable);
      }
    }
    this.isDBValid = false;
  }

  public async onNewDataVersion(): Promise<void> {
    await this.resetPreviews();
  }

  public async resetPreviews(): Promise<void> {
    this.persons = null;
    this.isDBValid = false;
  }

  private async loadAll(): Promise<void> {
    await this.updateDerivedValues();
    const connection = await SQLConnection.getConnection();
    const personRepository = connection.getRepository(PersonEntry);
    this.persons = await personRepository.find({
      relations: [
        'sampleRegion',
        'sampleRegion.media',
        'sampleRegion.media.directory',
        'sampleRegion.media.metadata',
      ],
    });
  }

  /**
   * Person table contains derived, denormalized data for faster select, this needs to be updated after data change
   * @private
   */
  private async updateDerivedValues(): Promise<void> {
    if (this.isDBValid === true) {
      return;
    }
    Logger.debug(LOG_TAG, 'Updating derived persons data');
    await PersonManager.updateCounts();
    await PersonManager.updateSamplePhotos();
    this.isDBValid = false;
  }
}
